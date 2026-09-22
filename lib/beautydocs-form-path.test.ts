import assert from "node:assert/strict";
import test from "node:test";
import {
  beautyDocsFormPreviewPath,
  findActiveFormBySlug,
  isValidFormSlug,
} from "./beautydocs-form-path";

const forms = [
  { code: "botox", displayName: "Toksyna botulinowa", displayOrder: 1 },
  {
    code: "permanent-makeup",
    displayName: "Makijaż permanentny",
    displayOrder: 2,
  },
] as const;

test("validates canonical lowercase form path segments", () => {
  assert.equal(isValidFormSlug("botox"), true);
  assert.equal(isValidFormSlug("permanent-makeup"), true);
  assert.equal(isValidFormSlug("PERMANENT_MAKEUP"), false);
  assert.equal(isValidFormSlug("../botox"), false);
  assert.equal(isValidFormSlug("botox?draft=true"), false);
  assert.equal(isValidFormSlug("-botox"), false);
});

test("matches only an active form with the exact canonical code", () => {
  assert.deepEqual(findActiveFormBySlug(forms, "botox"), forms[0]);
  assert.equal(findActiveFormBySlug(forms, "Botox"), null);
  assert.equal(findActiveFormBySlug(forms, "lip-augmentation"), null);
});

test("builds the opt-in shared forms preview path", () => {
  assert.equal(
    beautyDocsFormPreviewPath("powderbrows", "permanent-makeup"),
    "/f/powderbrows/permanent-makeup",
  );
  assert.throws(() => beautyDocsFormPreviewPath("app", "botox"), TypeError);
  assert.throws(
    () => beautyDocsFormPreviewPath("powderbrows", "../botox"),
    TypeError,
  );
});
