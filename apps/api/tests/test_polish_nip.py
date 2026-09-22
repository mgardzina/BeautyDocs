from app.services.polish_nip import is_valid_polish_nip, normalize_polish_nip


def test_normalizes_supported_nip_separators() -> None:
    assert normalize_polish_nip("865-231-42-72") == "8652314272"
    assert normalize_polish_nip("865 231 42 72") == "8652314272"


def test_validates_nip_length_digits_and_checksum() -> None:
    assert is_valid_polish_nip("865-231-42-72")
    assert is_valid_polish_nip("526-104-08-28")
    assert not is_valid_polish_nip("865-231-42-71")
    assert not is_valid_polish_nip("123456789")
    assert not is_valid_polish_nip("abcdefghij")
