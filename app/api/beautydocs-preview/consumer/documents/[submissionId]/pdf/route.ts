import { NextRequest } from "next/server";
import { fetchConsumerDocument, fetchConsumerDocumentSignature, fetchConsumerDocumentPractitionerSignature } from "@/lib/beautydocs-consumer-api";
import { consumerPdfData } from "@/lib/beautydocs-pdf";
import { formPdfResponse, pdfAccessError } from "@/lib/beautydocs-pdf-response";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;
  const cookie = request.headers.get("cookie");
  const result = await fetchConsumerDocument(submissionId, cookie);
  if (result.status !== "ok") return pdfAccessError(result.status);
  return formPdfResponse(consumerPdfData(result.data), result.data.signatureKeys,
    (key) => fetchConsumerDocumentSignature(submissionId, key, cookie),
    () => fetchConsumerDocumentPractitionerSignature(submissionId, cookie));
}
