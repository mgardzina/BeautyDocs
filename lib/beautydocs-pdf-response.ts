import { canDownloadFormPdf } from "./beautydocs-pdf-eligibility";
import { NextResponse } from "next/server";
import { generateBeautyDocsPdf, type FormPdfData } from "./beautydocs-pdf";

type BinaryResult = { status: "ok"; data: ArrayBuffer } | { status: string };
/** Fetch only authenticated, fixed API paths. Never accept an image URL from form answers. */
export async function formPdfResponse(
  data: FormPdfData,
  keys: readonly string[],
  loadSignature: (key: string) => Promise<BinaryResult>,
  loadPractitioner: () => Promise<BinaryResult>,
): Promise<NextResponse> {
  if (!canDownloadFormPdf(data.status, data.signedAt, data.practitionerSignedAt, keys)) {
    return NextResponse.json({ error: { code: "form_not_fully_signed" } }, {
      status: 409, headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    // Sequential loading bounds memory and API concurrency for signature-heavy documents.
    for (const key of new Set(keys)) {
      const result = await loadSignature(key);
      if (result.status !== "ok" || !("data" in result)) throw new Error("Signature unavailable");
      const image = Buffer.from(result.data);
      if (image.length > 1_000_000 || !image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("Invalid signature");
      data.signatures[key] = image;
    }
    if (data.practitionerSignedAt) {
      const result = await loadPractitioner();
      if (result.status !== "ok" || !("data" in result)) throw new Error("Practitioner signature unavailable");
      const image = Buffer.from(result.data);
      if (image.length > 1_000_000 || !image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("Invalid signature");
      data.practitionerSignature = image;
    }
    const pdf = await generateBeautyDocsPdf(data);
    return new NextResponse(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BeautyDocs-${data.id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    // Never return a seemingly complete PDF with a missing recorded signature.
    return NextResponse.json({ error: { code: "pdf_unavailable" } }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
export function pdfAccessError(status: string) {
  const code = status === "unauthorized" ? 401 : status === "forbidden" ? 403 : status === "not-found" ? 404 : 503;
  return NextResponse.json({ error: { code: status } }, { status: code, headers: { "Cache-Control": "private, no-store" } });
}
