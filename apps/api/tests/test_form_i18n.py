import json
import re
import sys
from pathlib import Path

import pytest

from app.services.form_i18n import (
    SUPPORTED_LANGUAGES,
    localize_form_content,
    localized_content_hash,
    translate_text,
)

CATALOG_DIR = Path(__file__).resolve().parents[1] / "app" / "i18n" / "form_content"
TRANSLATED_LANGUAGES = [language for language in SUPPORTED_LANGUAGES if language != "pl"]


def _provisioned_sources() -> list[str]:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    provision = pytest.importorskip("provision_powderbrows_forms")
    sources: list[str] = []

    def add(value: object) -> None:
        if isinstance(value, str) and value.strip():
            sources.append(value)

    for code, form_type, name, description in provision.CATALOG:
        add(name)
        add(description)
        schema = provision.build_schema(code, form_type, name)
        for section in schema["sections"]:
            add(section["title"])
            for field in section.get("fields", []):
                add(field["label"])
            for category in section.get("categories", []):
                add(category)
            for item in section.get("items", []):
                add(item["question"])
                add(item.get("followUpPlaceholder"))
                add(item.get("category"))
    legal = provision.LEGAL_CONTENT
    add(legal["documentForm"])
    for entry in [*legal["consents"], *legal["documents"]]:
        add(entry["title"])
        add(entry["text"])
    return sources


@pytest.mark.parametrize("language", TRANSLATED_LANGUAGES)
def test_every_provisioned_medical_and_legal_string_is_translated(language: str) -> None:
    catalog = json.loads((CATALOG_DIR / f"{language}.json").read_text(encoding="utf-8"))
    missing = [source for source in _provisioned_sources() if source not in catalog]
    assert missing == []


@pytest.mark.parametrize("language", TRANSLATED_LANGUAGES)
def test_translations_keep_placeholders_and_paragraphs(language: str) -> None:
    catalog = json.loads((CATALOG_DIR / f"{language}.json").read_text(encoding="utf-8"))
    for source, translated in catalog.items():
        assert re.findall(r"\{\{\w+\}\}", source) == re.findall(r"\{\{\w+\}\}", translated), source
        assert source.count("\n") == translated.count("\n"), source
        assert translated.strip(), source


def test_localize_translates_text_but_never_keys_or_structure() -> None:
    definition = {
        "treatment": "Mezoterapia igłowa",
        "sections": [
            {
                "key": "przeciwwskazania",
                "title": "Wywiad medyczny / przeciwwskazania",
                "type": "contraindications",
                "categories": ["BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU"],
                "items": [
                    {
                        "key": "nowotwor",
                        "question": "Czy choruje Pani/Pan na nowotwór?",
                        "type": "yes_no",
                        "hasFollowUp": False,
                        "category": "BEZWZGLĘDNE PRZECIWSKAZANIA DO WYKONANIA ZABIEGU",
                    }
                ],
            }
        ],
    }
    legal = {"consents": [{"key": "zgodaMarketing", "title": "Zgoda marketingowa", "text": "Nieznany tekst"}]}

    shown_definition, shown_legal, locale = localize_form_content(definition, legal, "en")

    assert locale == "en"
    item = shown_definition["sections"][0]["items"][0]
    assert item["key"] == "nowotwor"
    assert item["type"] == "yes_no"
    assert item["question"] == "Do you have cancer?"
    assert item["category"] == "ABSOLUTE CONTRAINDICATIONS TO THE TREATMENT"
    assert shown_definition["sections"][0]["categories"] == [item["category"]]
    assert shown_legal["consents"][0]["title"] == "Marketing consent"
    # Unknown or edited wording falls back to the Polish original, never a stale translation.
    assert shown_legal["consents"][0]["text"] == "Nieznany tekst"
    # The published source is never mutated.
    assert definition["sections"][0]["items"][0]["question"] == "Czy choruje Pani/Pan na nowotwór?"


def test_polish_and_unknown_languages_return_source_content() -> None:
    definition = {"sections": [{"key": "zgody", "title": "Zgody", "fields": []}]}
    for language in ("pl", "xx"):
        shown, _, locale = localize_form_content(definition, {}, language)
        assert locale == "pl"
        assert shown == definition
    assert translate_text("Zgody", "de") == "Einwilligungen"
    assert translate_text(None, "de") is None


def test_content_hash_differs_per_language() -> None:
    definition = {"sections": [{"key": "zgody", "title": "Zgody", "fields": []}]}
    polish = localized_content_hash(*localize_form_content(definition, {}, "pl")[:2])
    french = localized_content_hash(*localize_form_content(definition, {}, "fr")[:2])
    assert polish != french
