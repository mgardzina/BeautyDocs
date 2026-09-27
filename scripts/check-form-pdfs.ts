/** PDF layout QA against every real catalogue questionnaire, with synthetic answers only. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateBeautyDocsPdf, type FormPdfData } from "../lib/beautydocs-pdf";

async function main() {
  const fixtures = JSON.parse(await readFile("tmp/pdfs/catalog-fixtures.json", "utf8")) as Array<Pick<FormPdfData, "title" | "sections" | "anatomy"> & { code: string }>;
  fixtures.push({ code: "stress", title: "Długi formularz - próba podziału stron", anatomy: null, sections: [{ key: "long", title: "Długie odpowiedzi", items: [{ key: "long-answer", label: "Szczegółowa odpowiedź", kind: "field", value: "Zażółć gęślą jaźń. ".repeat(250), detail: "Dodatkowe informacje. ".repeat(200) }] }] });
  const signature = await readFile("scripts/fixtures/pdf-signature.png");
  await mkdir("output/pdf", { recursive: true });
  for (const fixture of fixtures) {
    const pdf = await generateBeautyDocsPdf({ ...fixture, id: "00000000-0000-4000-8000-000000000001", salon: "Salon Przykładowy - DANE TESTOWE", version: 1, status: "SIGNED", signedAt: "2026-09-26T10:00:00Z", signatures: { podpisRodo: signature }, practitionerName: "Jan Przykładowy", practitionerSignedAt: "2026-09-26T11:00:00Z", practitionerSignature: signature, documentHash: "a".repeat(64), treatmentAreaIds: ["forehead", "belly"] });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    await writeFile(`tmp/pdfs/${fixture.code}.pdf`, pdf);
    if (fixture.code === "modelowanie-ust") await writeFile("output/pdf/beautydocs-formularz-przyklad.pdf", pdf);
    console.log(`${fixture.code}: ${pdf.length} bytes`);
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
