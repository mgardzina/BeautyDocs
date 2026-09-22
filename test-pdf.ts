/** Standalone PDF smoke check using synthetic input; no database access. */
import assert from "node:assert/strict";
import { generateConsentFormPdf } from "./lib/pdfGenerator";

async function main() {
  const pdf = await generateConsentFormPdf({
    id: "synthetic-pdf-check",
    type: "LIP_AUGMENTATION",
    createdAt: "2026-09-12T10:00:00.000Z",
    imieNazwisko: "Testowa Klientka",
    telefon: "000000000",
    miejscowoscData: "Test, 12.09.2026",
    obszarZabiegu: "usta",
    przeciwwskazania: {},
    zgodaPrzetwarzanieDanych: true,
    zgodaMarketing: false,
    zgodaFotografie: false,
    zgodaPomocPrawna: false,
  });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  console.log(`PDF generated successfully (${pdf.byteLength} bytes).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
