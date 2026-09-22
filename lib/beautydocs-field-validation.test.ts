import assert from "node:assert/strict";
import test from "node:test";
import { validateBeautyDocsFields } from "./beautydocs-field-validation";
import type { FormField } from "../types/tenant";

const field = (key: string, required = true, type = "text"): FormField => ({ key, label: key, required, type });
const today = new Date(2026, 8, 11, 12);

test("returns every missing field and skips optional fields and signatures in the details step", () => {
  const errors = validateBeautyDocsFields([field("name"), field("city"), field("email", false), field("signature", true, "signature"), field("consent", true, "consent")], {}, [], false, today);
  assert.deepEqual(Object.keys(errors), ["name", "city"]);
});

test("rejects impossible and incomplete birth dates and handles the eighteenth birthday boundary", () => {
  const fields = [field("dataUrodzenia")];
  for (const value of ["2000-02-31", "2000-02-", "--", "2027-01-01", "2008-09-12"]) {
    assert.ok(validateBeautyDocsFields(fields, { dataUrodzenia: value }, [], false, today).dataUrodzenia, value);
  }
  for (const value of ["2008-09-11", "2000-02-29"]) {
    assert.deepEqual(validateBeautyDocsFields(fields, { dataUrodzenia: value }, [], false, today), {});
  }
});

test("clears errors after correction and validates optional email only when supplied", () => {
  const fields = [field("email", false, "email")];
  assert.ok(validateBeautyDocsFields(fields, { email: "anna@" }, [], false).email);
  for (const email of ["", "anna@example.com"]) {
    assert.deepEqual(validateBeautyDocsFields(fields, { email }, [], false), {});
  }
});

test("uses map selection for mapped treatment fields and text for other forms", () => {
  const fields = [field("obszarZabiegu")];
  assert.ok(validateBeautyDocsFields(fields, {}, [], true).obszarZabiegu);
  assert.deepEqual(validateBeautyDocsFields(fields, {}, ["forehead"], true), {});
  assert.deepEqual(validateBeautyDocsFields(fields, { obszarZabiegu: "Twarz" }, [], false), {});
});
