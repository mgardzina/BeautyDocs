from __future__ import annotations

import hmac
import ipaddress
import re
from urllib.parse import urlsplit

from fastapi import Request

from app.core.config import Settings
from app.core.context import RequestContext, TenantContext, request_id_from
from app.core.errors import AppError

TENANT_SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def _validated_slug(raw_slug: str, settings: Settings) -> str:
    slug = raw_slug.strip().lower()
    if not TENANT_SLUG_PATTERN.fullmatch(slug):
        raise AppError(
            status_code=400,
            code="invalid_tenant",
            message="Tenant identifier is invalid",
        )
    if slug in settings.reserved_subdomains:
        raise AppError(
            status_code=404,
            code="tenant_not_found",
            message="Tenant was not found",
        )
    return slug


def _hostname_from_host_header(request: Request) -> str:
    raw_host = request.headers.get("host", "")
    if not raw_host or any(character.isspace() for character in raw_host):
        raise AppError(status_code=400, code="invalid_host", message="Host header is invalid")
    try:
        parsed_host = urlsplit(f"//{raw_host}")
        hostname = parsed_host.hostname
        # Accessing `.port` also validates malformed or out-of-range port values.
        _ = parsed_host.port
    except ValueError as exc:
        raise AppError(
            status_code=400, code="invalid_host", message="Host header is invalid"
        ) from exc
    if (
        hostname is None
        or parsed_host.username is not None
        or parsed_host.password is not None
        or parsed_host.path
        or parsed_host.query
        or parsed_host.fragment
    ):
        raise AppError(status_code=400, code="invalid_host", message="Host header is invalid")
    return hostname.lower().rstrip(".")


def _tenant_from_host(request: Request, settings: Settings) -> TenantContext:
    hostname = _hostname_from_host_header(request)
    domain_suffix = f".{settings.tenant_root_domain}"

    if hostname.endswith(domain_suffix):
        slug = hostname[: -len(domain_suffix)]
        if "." in slug:
            raise AppError(
                status_code=404,
                code="tenant_not_found",
                message="Tenant was not found",
            )
        return TenantContext(slug=_validated_slug(slug, settings), source="host")

    if settings.allow_localhost_tenants and hostname.endswith(".localhost"):
        slug = hostname[: -len(".localhost")]
        if "." not in slug:
            return TenantContext(slug=_validated_slug(slug, settings), source="host")

    raise AppError(
        status_code=404,
        code="tenant_not_found",
        message="Tenant was not found",
    )


def _is_trusted_proxy(request: Request, settings: Settings) -> bool:
    if request.client is None:
        return False
    try:
        client_ip = ipaddress.ip_address(request.client.host)
    except ValueError:
        return False
    return any(client_ip in network for network in settings.parsed_trusted_proxy_networks)


def _tenant_from_trusted_header(request: Request, settings: Settings) -> TenantContext | None:
    raw_tenant = request.headers.get(settings.internal_tenant_header_name)
    if raw_tenant is None:
        return None

    configured_secret = settings.internal_tenant_header_secret
    supplied_secret = request.headers.get(settings.internal_tenant_secret_header_name)
    if (
        configured_secret is None
        or supplied_secret is None
        or not _is_trusted_proxy(request, settings)
        or not hmac.compare_digest(configured_secret.get_secret_value(), supplied_secret)
    ):
        raise AppError(
            status_code=403,
            code="untrusted_tenant_header",
            message="Internal tenant header is not trusted",
        )

    return TenantContext(slug=_validated_slug(raw_tenant, settings), source="internal_header")


def resolve_tenant(request: Request, settings: Settings) -> TenantContext:
    tenant_from_header = _tenant_from_trusted_header(request, settings)
    if tenant_from_header is not None:
        return tenant_from_header
    return _tenant_from_host(request, settings)


def build_request_context(request: Request, settings: Settings) -> RequestContext:
    return RequestContext(
        request_id=request_id_from(request),
        tenant=resolve_tenant(request, settings),
    )
