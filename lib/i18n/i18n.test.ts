import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSources, loadCatalog } from "../../scripts/i18n-messages.mjs";
import { negotiateLocale } from "./config";
import { createTranslator, interpolate } from "./translate";

test("negotiates the best supported language from Accept-Language", () => {
  assert.equal(negotiateLocale("de-DE,de;q=0.9,en;q=0.8"), "de");
  assert.equal(negotiateLocale("it-IT,it;q=0.9,fr;q=0.5"), "fr");
  assert.equal(negotiateLocale("en;q=0.2,es;q=0.8"), "es");
  assert.equal(negotiateLocale("ja-JP"), "pl");
  assert.equal(negotiateLocale(null), "pl");
});

test("falls back to the Polish source and interpolates values", () => {
  const t = createTranslator({ "Witaj, {name}": "Hello, {name}" });
  assert.equal(t("Witaj, {name}", { name: "Ada" }), "Hello, Ada");
  assert.equal(t("Nieprzetłumaczone"), "Nieprzetłumaczone");
  assert.equal(t(null), null);
  assert.equal(t(undefined), undefined);
  assert.equal(interpolate("{a} i {b}", { a: 1 }), "1 i {b}");
});

test("every UI string is translated in every language with matching placeholders", () => {
  const sources: string[] = collectSources();
  assert.ok(sources.length > 1000, "expected the full UI string inventory");
  const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const locale of ["en", "de", "es", "fr"]) {
    const catalog: Record<string, string> = loadCatalog(locale);
    const missing = sources.filter((source) => !Object.hasOwn(catalog, source));
    assert.deepEqual(missing, [], `${locale} is missing translations`);
    for (const source of sources) {
      assert.equal(placeholders(catalog[source]), placeholders(source), `${locale}: ${source}`);
    }
  }
});
