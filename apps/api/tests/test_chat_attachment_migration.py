from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION = API_ROOT / "alembic" / "versions" / "20260816_0026_chat_attachments.py"


def test_chat_attachment_migration_preserves_tenant_scoped_links() -> None:
    source = MIGRATION.read_text(encoding="utf-8")
    assert 'revision: str = "20260816_0026"' in source
    assert 'down_revision: str | None = "20260811_0025"' in source
    assert '"chat_attachments"' in source
    assert '"fk_chat_attachment_conversation"' in source
    assert '"fk_chat_attachment_message"' in source
    assert '"fk_chat_attachment_file_object"' in source
    assert '"uq_chat_message_conversation_event"' in source
    assert "'VISIT_REMINDER'" in source
