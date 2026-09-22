from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from xml.etree import ElementTree

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

_SOAP_NAMESPACE = "http://www.w3.org/2003/05/soap-envelope"
_ADDRESSING_NAMESPACE = "http://www.w3.org/2005/08/addressing"
_SERVICE_NAMESPACE = "http://CIS/BIR/PUBL/2014/07"
_DATA_NAMESPACE = "http://CIS/BIR/PUBL/2014/07/DataContract"


@dataclass(frozen=True, slots=True)
class RegonCompany:
    nip: str
    regon: str
    krs: str | None
    name: str
    status_nip: str | None
    street: str
    postal_code: str
    city: str
    activity_ended_at: str | None


class RegonRegistryNotConfiguredError(Exception):
    pass


class RegonRegistryNotFoundError(Exception):
    pass


class RegonRegistryUnavailableError(Exception):
    pass


def _soap_envelope(*, endpoint: str, action: str, body: str) -> str:
    return (
        f'<s:Envelope xmlns:s="{_SOAP_NAMESPACE}" xmlns:a="{_ADDRESSING_NAMESPACE}">'
        "<s:Header>"
        f'<a:Action s:mustUnderstand="1">{html.escape(action)}</a:Action>'
        f'<a:To s:mustUnderstand="1">{html.escape(endpoint)}</a:To>'
        "</s:Header>"
        f"<s:Body>{body}</s:Body>"
        "</s:Envelope>"
    )


def _response_value(response_xml: str, result_name: str) -> str:
    try:
        root = ElementTree.fromstring(response_xml)
    except ElementTree.ParseError as exc:
        raise RegonRegistryUnavailableError from exc

    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] == result_name:
            return (element.text or "").strip()
    raise RegonRegistryUnavailableError


def _result_rows(result_xml: str) -> list[dict[str, str]]:
    if not result_xml.strip():
        return []
    try:
        root = ElementTree.fromstring(result_xml)
    except ElementTree.ParseError as exc:
        raise RegonRegistryUnavailableError from exc

    rows: list[dict[str, str]] = []
    elements = [root] if root.tag.rsplit("}", 1)[-1] == "dane" else list(root)
    for row in elements:
        if row.tag.rsplit("}", 1)[-1] != "dane":
            continue
        rows.append(
            {
                child.tag.rsplit("}", 1)[-1]: (child.text or "").strip()
                for child in row
            }
        )
    return rows


def _street_from_row(row: dict[str, str]) -> str:
    street = row.get("Ulica", "").strip()
    building = row.get("NrNieruchomosci", "").strip()
    apartment = row.get("NrLokalu", "").strip()

    result = f"{street} {building}" if street and building else street or building
    if apartment:
        result = f"{result}/{apartment}" if result else apartment
    return result


def _company_from_result(
    nip: str,
    result_xml: str,
    *,
    krs: str | None = None,
) -> tuple[RegonCompany, dict[str, str]]:
    rows = _result_rows(result_xml)
    if not rows:
        raise RegonRegistryNotFoundError

    row = next((item for item in rows if item.get("Nip") == nip), rows[0])
    name = row.get("Nazwa", "").strip()
    if not name:
        raise RegonRegistryUnavailableError

    return RegonCompany(
        nip=row.get("Nip", nip).strip() or nip,
        regon=row.get("Regon", "").strip(),
        krs=krs,
        name=name,
        status_nip=row.get("StatusNip", "").strip() or None,
        street=_street_from_row(row),
        postal_code=row.get("KodPocztowy", "").strip(),
        city=row.get("Miejscowosc", "").strip(),
        activity_ended_at=row.get("DataZakonczeniaDzialalnosci", "").strip() or None,
    ), row


def _krs_from_full_report(result_xml: str) -> str | None:
    for row in _result_rows(result_xml):
        normalized = {key.lower(): value.strip() for key, value in row.items()}
        register_kind = next(
            (
                value
                for key, value in normalized.items()
                if key.endswith("rodzajrejestruewidencji_nazwa")
            ),
            "",
        )
        register_number = next(
            (
                value
                for key, value in normalized.items()
                if key.endswith("numerwrejestrzeewidencji")
            ),
            "",
        )
        register_authority = next(
            (
                value
                for key, value in normalized.items()
                if key.endswith("organrejestrowy_nazwa")
            ),
            "",
        )
        registry_description = f"{register_kind} {register_authority}".upper()
        if register_number and (
            "KRS" in registry_description
            or "KRAJOWEGO REJESTRU SĄDOWEGO" in registry_description
            or "KRAJOWY REJESTR SĄDOWY" in registry_description
        ):
            return register_number
    return None


async def _call(
    client: httpx.AsyncClient,
    *,
    endpoint: str,
    operation: str,
    body: str,
    sid: str | None = None,
) -> str:
    action = f"{_SERVICE_NAMESPACE}/IUslugaBIRzewnPubl/{operation}"
    headers = {
        "Accept": "application/soap+xml",
        "Content-Type": f'application/soap+xml; charset=utf-8; action="{action}"',
    }
    if sid is not None:
        headers["sid"] = sid
    response = await client.post(
        endpoint,
        headers=headers,
        content=_soap_envelope(endpoint=endpoint, action=action, body=body),
    )
    response.raise_for_status()
    return response.text


async def lookup_company_by_nip(nip: str, settings: Settings) -> RegonCompany:
    if settings.regon_api_key is None:
        raise RegonRegistryNotConfiguredError

    endpoint = settings.regon_api_url
    api_key = settings.regon_api_key.get_secret_value()
    login_body = (
        f'<Zaloguj xmlns="{_SERVICE_NAMESPACE}">'
        f"<pKluczUzytkownika>{html.escape(api_key)}</pKluczUzytkownika>"
        "</Zaloguj>"
    )

    sid: str | None = None
    try:
        async with httpx.AsyncClient(timeout=settings.regon_api_timeout_seconds) as client:
            login_response = await _call(
                client,
                endpoint=endpoint,
                operation="Zaloguj",
                body=login_body,
            )
            sid = _response_value(login_response, "ZalogujResult")
            if not sid:
                raise RegonRegistryUnavailableError

            search_body = (
                f'<DaneSzukajPodmioty xmlns="{_SERVICE_NAMESPACE}">'
                "<pParametryWyszukiwania>"
                f'<Nip xmlns="{_DATA_NAMESPACE}">{nip}</Nip>'
                "</pParametryWyszukiwania>"
                "</DaneSzukajPodmioty>"
            )
            search_response = await _call(
                client,
                endpoint=endpoint,
                operation="DaneSzukajPodmioty",
                body=search_body,
                sid=sid,
            )
            result_xml = _response_value(search_response, "DaneSzukajPodmiotyResult")
            company, search_row = _company_from_result(nip, result_xml)

            # A KRS number is not part of the basic NIP search result. For legal
            # entities GUS exposes it in the full BIR11 report. Failure of this
            # optional request must not discard the otherwise valid company data.
            if search_row.get("Typ") == "P" and company.regon:
                try:
                    report_body = (
                        f'<DanePobierzPelnyRaport xmlns="{_SERVICE_NAMESPACE}">'
                        f"<pRegon>{html.escape(company.regon)}</pRegon>"
                        "<pNazwaRaportu>BIR12OsPrawna</pNazwaRaportu>"
                        "</DanePobierzPelnyRaport>"
                    )
                    report_response = await _call(
                        client,
                        endpoint=endpoint,
                        operation="DanePobierzPelnyRaport",
                        body=report_body,
                        sid=sid,
                    )
                    report_xml = _response_value(
                        report_response,
                        "DanePobierzPelnyRaportResult",
                    )
                    company = RegonCompany(
                        nip=company.nip,
                        regon=company.regon,
                        krs=_krs_from_full_report(report_xml),
                        name=company.name,
                        status_nip=company.status_nip,
                        street=company.street,
                        postal_code=company.postal_code,
                        city=company.city,
                        activity_ended_at=company.activity_ended_at,
                    )
                except (httpx.HTTPError, RegonRegistryUnavailableError):
                    logger.info("REGON detailed KRS lookup failed", exc_info=True)
            return company
    except RegonRegistryNotFoundError:
        raise
    except (httpx.HTTPError, RegonRegistryUnavailableError, ValueError, TypeError):
        logger.warning("REGON registry lookup failed", exc_info=True)
        raise RegonRegistryUnavailableError from None
    finally:
        if sid:
            try:
                logout_body = (
                    f'<Wyloguj xmlns="{_SERVICE_NAMESPACE}">'
                    f"<pIdentyfikatorSesji>{html.escape(sid)}</pIdentyfikatorSesji>"
                    "</Wyloguj>"
                )
                async with httpx.AsyncClient(
                    timeout=settings.regon_api_timeout_seconds
                ) as logout_client:
                    await _call(
                        logout_client,
                        endpoint=endpoint,
                        operation="Wyloguj",
                        body=logout_body,
                        sid=sid,
                    )
            except httpx.HTTPError:
                logger.info("REGON registry logout failed", exc_info=True)
