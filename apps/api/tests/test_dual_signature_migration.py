from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "20260729_0006_dual_sms_signatures.py"
)


def test_dual_signature_migration_binds_otp_to_both_signers() -> None:
    source = MIGRATION.read_text(encoding="utf-8")
    assert '"signer_type"' in source
    assert "CLIENT" in source
    assert "PRACTITIONER" in source
    assert '"signer_membership_id"' in source
    assert '"signer_team_member_id"' in source
    assert '"document_hash"' in source
    assert '"requested_ip_address"' in source
    assert '"verified_user_agent"' in source
    assert '"consumed_at"' in source


def test_dual_signature_migration_adds_staff_phone_and_final_signature() -> None:
    source = MIGRATION.read_text(encoding="utf-8")
    assert '"phone_normalized"' in source
    assert '"public_access_token_digest"' in source
    assert '"practitioner_signed_at"' in source
    assert '"practitioner_signature_data_url"' in source
