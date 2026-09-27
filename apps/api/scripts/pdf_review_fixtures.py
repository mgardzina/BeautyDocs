"""Synthetic records for print QA. Reads the catalogue; never connects to a database."""

import json
from pathlib import Path

from app.api.routes.admin_clients import _build_form_answer_sections
from scripts.provision_powderbrows_forms import CATALOG, LEGAL_CONTENT, build_schema


def main():
    output = []
    for code, form_type, name, _ in CATALOG:
        definition = build_schema(code, form_type, name)
        answers = {
            "fields": {"nazwaProduktu": "Przykładowy produkt", "contraindications": {}},
            "consents": {"zgodaPrzetwarzanieDanych": True, "zgodaMarketing": False},
            "placeAndDate": "Warszawa, 26.09.2026",
        }
        snapshot = {
            "client": {"fullName": "Anna Przykładowa", "phone": "+48000000000"},
            "answers": answers,
            "signatures": {"podpisRodo": "test-only"},
        }
        sections, _ = _build_form_answer_sections(
            definition=definition,
            legal_content=LEGAL_CONTENT,
            stored_answers=answers,
            document_snapshot=snapshot,
            salon_name="Salon Przykładowy - DANE TESTOWE",
        )
        output.append(
            {
                "code": code,
                "title": name,
                "sections": [s.model_dump(by_alias=True) for s in sections],
                "anatomy": definition.get("anatomy"),
            }
        )
    target = Path("../../tmp/pdfs/catalog-fixtures.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
