from app.services.signature_sms import _smsapi_error_code


def test_smsapi_error_code_accepts_numeric_provider_error() -> None:
    assert _smsapi_error_code({"error": 103, "message": "No points"}) == 103


def test_smsapi_error_code_accepts_legacy_string_provider_error() -> None:
    assert _smsapi_error_code({"error": "103"}) == 103


def test_smsapi_error_code_rejects_unexpected_payload() -> None:
    assert _smsapi_error_code({"error": "authorization_failed"}) is None
    assert _smsapi_error_code([]) is None
