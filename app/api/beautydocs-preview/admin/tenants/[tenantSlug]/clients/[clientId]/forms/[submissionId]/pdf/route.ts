import { NextRequest } from "next/server";
import { fetchBeautyDocsAdminClientFormDetail, fetchBeautyDocsAdminClientFormSignature, fetchBeautyDocsAdminClientFormPractitionerSignature } from "@/lib/beautydocs-admin-api";
import { adminPdfData } from "@/lib/beautydocs-pdf";
import { formPdfResponse, pdfAccessError } from "@/lib/beautydocs-pdf-response";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string; clientId: string; submissionId: string }> }) {
  const { tenantSlug, clientId, submissionId } = await context.params;
  const cookie = request.headers.get("cookie");
  const result = await fetchBeautyDocsAdminClientFormDetail(tenantSlug, clientId, submissionId, cookie);
  if (result.status !== "ok") return pdfAccessError(result.status);
  return formPdfResponse(adminPdfData(result.data, tenantSlug), result.data.signatureKeys,
    (key) => fetchBeautyDocsAdminClientFormSignature(tenantSlug, clientId, submissionId, key, cookie),
    () => fetchBeautyDocsAdminClientFormPractitionerSignature(tenantSlug, clientId, submissionId, cookie));
}
