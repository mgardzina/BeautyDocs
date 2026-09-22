import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPolishNipInput,
  isValidPolishNip,
  normalizePolishNip,
} from "./polish-nip";

test("normalizes common Polish NIP separators", () => {
  assert.equal(normalizePolishNip("865-231-42-72"), "8652314272");
  assert.equal(normalizePolishNip("865 231 42 72"), "8652314272");
});

test("validates length, digits and the NIP checksum", () => {
  assert.equal(isValidPolishNip("865-231-42-72"), true);
  assert.equal(isValidPolishNip("526-104-08-28"), true);
  assert.equal(isValidPolishNip("865-231-42-71"), false);
  assert.equal(isValidPolishNip("123456789"), false);
  assert.equal(isValidPolishNip("abcdefghij"), false);
});

test("formats at most ten digits while the user types", () => {
  assert.equal(formatPolishNipInput("8652314"), "865-231-4");
  assert.equal(formatPolishNipInput("865 231 42 72 99"), "865-231-42-72");
});
