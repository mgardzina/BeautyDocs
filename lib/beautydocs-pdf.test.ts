import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formPdfResponse, pdfAccessError } from "./beautydocs-pdf-response";
import type { FormPdfData } from "./beautydocs-pdf";

const data = (): FormPdfData => ({ id: "00000000-0000-4000-8000-000000000001", title: "Żółć - test formularza", salon: "Salon testowy", version: 1, status: "SIGNED", signedAt: "2026-09-26T10:00:00Z", sections: [], anatomy: null, treatmentAreaIds: [], signatures: {}, practitionerName: null, practitionerSignedAt: "2026-09-26T11:00:00Z", practitionerSignature: null, documentHash: null });
test("PDF preserves access error status and disables caching", () => {
  for (const [status, code] of [["unauthorized",401],["forbidden",403],["not-found",404],["unavailable",503]] as const) {
    const response = pdfAccessError(status);
    assert.equal(response.status,code);
    assert.match(response.headers.get("cache-control")!,/no-store/);
  }
});
test("missing recorded signatures fail closed instead of exporting an incomplete form", async () => {
  const response = await formPdfResponse(data(), ["podpisDane"], async () => ({status:"not-found"}), async () => { throw new Error("Must not run"); });
  assert.equal(response.status,503);
  assert.match(response.headers.get("content-type")!,/json/);
});
test("invalid signature data cannot become remote PDF resources", async () => {
  const response = await formPdfResponse(data(), ["podpisDane"], async () => ({status:"ok", data: new TextEncoder().encode("https://example.test/private").buffer}), async () => ({status:"not-found"}));
  assert.equal(response.status,503);
});
test("missing practitioner signature also prevents download", async () => {
  const input=data(); input.practitionerSignedAt="2026-09-26T10:00:00Z";
  const response=await formPdfResponse(input,["podpisDane"],async()=>({status:"not-found"}),async()=>({status:"not-found"}));
  assert.equal(response.status,503);
});
test("download is a private PDF attachment generated without external fonts", async () => {
  const bytes = await readFile("scripts/fixtures/pdf-signature.png");
  const image = Uint8Array.from(bytes).buffer;
  const response = await formPdfResponse(data(),["podpisDane"],async()=>({status:"ok",data:image}),async()=>({status:"ok",data:image}));
  assert.equal(response.status,200);
  assert.equal(response.headers.get("content-type"),"application/pdf");
  assert.match(response.headers.get("content-disposition")!,/^attachment; filename="BeautyDocs-/);
  assert.match(response.headers.get("cache-control")!,/private, no-store/);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),"%PDF-");
});

test("unfinished documents cannot be downloaded even through a direct request", async () => {
  const cases: Array<[FormPdfData, string[]]> = [
    [{...data(), status: "SUBMITTED"}, ["podpisDane"]],
    [{...data(), status: "DRAFT"}, ["podpisDane"]],
    [{...data(), signedAt: null}, ["podpisDane"]],
    [{...data(), practitionerSignedAt: null}, ["podpisDane"]],
    [{...data(), practitionerSignedAt: "invalid"}, ["podpisDane"]],
    [data(), []],
  ];
  for (const [input, keys] of cases) {
    const neverLoad = async (): Promise<never> => { throw new Error("Should not fetch signatures"); };
    const response = await formPdfResponse(input, keys, neverLoad, neverLoad);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "form_not_fully_signed");
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});
