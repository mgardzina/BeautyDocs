from app.services.regon_registry import _company_from_result, _krs_from_full_report


def test_maps_basic_gus_result_to_registration_fields() -> None:
    company, row = _company_from_result(
        "8652314272",
        """
        <root>
          <dane>
            <Regon>383931003</Regon>
            <Nip>8652314272</Nip>
            <StatusNip>Aktywny</StatusNip>
            <Nazwa>PowderBrows Academy Malwina Zięba</Nazwa>
            <Wojewodztwo>PODKARPACKIE</Wojewodztwo>
            <Miejscowosc>Stalowa Wola</Miejscowosc>
            <KodPocztowy>37-450</KodPocztowy>
            <Ulica>ul. Siedlanowskiego</Ulica>
            <NrNieruchomosci>3</NrNieruchomosci>
            <NrLokalu>12</NrLokalu>
            <Typ>F</Typ>
          </dane>
        </root>
        """,
    )

    assert company.nip == "8652314272"
    assert company.regon == "383931003"
    assert company.name == "PowderBrows Academy Malwina Zięba"
    assert company.street == "ul. Siedlanowskiego 3/12"
    assert company.postal_code == "37-450"
    assert company.city == "Stalowa Wola"
    assert row["Typ"] == "F"


def test_extracts_krs_only_when_detailed_report_identifies_krs_register() -> None:
    assert (
        _krs_from_full_report(
            "<root><dane>"
            "<praw_rodzajRejestruEwidencji_Nazwa>REJESTR PRZEDSIĘBIORCÓW"
            "</praw_rodzajRejestruEwidencji_Nazwa>"
            "<praw_organRejestrowy_Nazwa>SĄD REJONOWY, WYDZIAŁ GOSPODARCZY "
            "KRAJOWEGO REJESTRU SĄDOWEGO</praw_organRejestrowy_Nazwa>"
            "<praw_numerWRejestrzeEwidencji>0000123456"
            "</praw_numerWRejestrzeEwidencji>"
            "</dane></root>"
        )
        == "0000123456"
    )
    assert (
        _krs_from_full_report(
            """
            <root><dane>
              <fizC_rodzajRejestruEwidencji_Nazwa>CEIDG</fizC_rodzajRejestruEwidencji_Nazwa>
              <fizC_numerWRejestrzeEwidencji>12345</fizC_numerWRejestrzeEwidencji>
            </dane></root>
            """
        )
        is None
    )
