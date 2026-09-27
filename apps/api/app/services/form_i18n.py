"""Translate published form content (medical questionnaire, consents, legal text).

Published template versions stay Polish and immutable. Translations are an
overlay keyed by the *exact* Polish source string, so any later wording change
in a template falls back to the Polish original instead of showing a stale
translation of medical or legal text. Keys, types and structure are never
touched, so answers submitted from any language are stored identically.
"""

from __future__ import annotations

import copy
import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, get_args

InterfaceLanguage = Literal["pl", "en", "de", "es", "fr"]
SUPPORTED_LANGUAGES: tuple[str, ...] = get_args(InterfaceLanguage)
SOURCE_LANGUAGE = "pl"

_CATALOG_DIR = Path(__file__).resolve().parent.parent / "i18n" / "form_content"
_TEXT_KEYS = frozenset(
    {"title", "label", "question", "followUpPlaceholder", "category", "text", "documentForm", "treatment"}
)
_TEXT_LIST_KEYS = frozenset({"categories"})


@lru_cache(maxsize=len(SUPPORTED_LANGUAGES))
def _catalog(language: str) -> dict[str, str]:
    if language == SOURCE_LANGUAGE or language not in SUPPORTED_LANGUAGES:
        return {}
    path = _CATALOG_DIR / f"{language}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def translate_text(value: str | None, language: str) -> str | None:
    if value is None:
        return None
    return _catalog(language).get(value, value)


def _localize(node: Any, catalog: dict[str, str]) -> Any:
    if isinstance(node, list):
        return [_localize(item, catalog) for item in node]
    if not isinstance(node, dict):
        return node
    localized: dict[str, Any] = {}
    for key, value in node.items():
        if key in _TEXT_KEYS and isinstance(value, str):
            localized[key] = catalog.get(value, value)
        elif key in _TEXT_LIST_KEYS and isinstance(value, list):
            localized[key] = [catalog.get(item, item) if isinstance(item, str) else item for item in value]
        else:
            localized[key] = _localize(value, catalog)
    return localized


def localize_form_content(
    definition: dict[str, Any],
    legal: dict[str, Any],
    language: str,
) -> tuple[dict[str, Any], dict[str, Any], str]:
    """Return (definition, legal, content_locale) for the requested language."""

    catalog = _catalog(language)
    if not catalog:
        return copy.deepcopy(definition), copy.deepcopy(legal), SOURCE_LANGUAGE
    return _localize(definition, catalog), _localize(legal, catalog), language


def localized_content_hash(definition: dict[str, Any], legal: dict[str, Any]) -> str:
    """Fingerprint of exactly what the signer was shown, for the signed snapshot."""

    payload = json.dumps({"schema": definition, "legal": legal}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
