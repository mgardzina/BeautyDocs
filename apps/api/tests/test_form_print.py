from app.services.form_print import form_print_metadata


def test_print_metadata_uses_saved_title_and_version_without_private_image_data():
    snapshot = {
        "formName": "Zapisana nazwa",
        "templateVersion": 2,
        "clientSignedAt": "2026-09-26T10:00:00Z",
        "signatures": {"podpisDane": "private"},
    }
    result = form_print_metadata(
        snapshot, "Salon", "a" * 64, form_name="Nowa nazwa", template_version=3
    )
    payload = result.model_dump(by_alias=True, mode="json")
    assert payload["formName"] == "Zapisana nazwa"
    assert payload["templateVersion"] == 2
    assert payload["clientSignedAt"] == "2026-09-26T10:00:00Z"
    assert payload["documentHash"] == "a" * 64
    assert "signatures" not in payload


def test_older_record_uses_versioned_template_fallback_without_inventing_signature_date():
    result = form_print_metadata({}, "Salon", None, form_name="Formularz", template_version=1)
    assert result.form_name == "Formularz"
    assert result.template_version == 1
    assert result.client_signed_at is None
