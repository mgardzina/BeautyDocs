/** Shared by download controls and the authenticated PDF response. */
export function canDownloadFormPdf(
  status: string,
  clientSignedAt: string | null | undefined,
  practitionerSignedAt: string | null | undefined,
  signatureKeys: readonly string[],
): boolean {
  return status === "SIGNED" &&
    Boolean(clientSignedAt && Number.isFinite(Date.parse(clientSignedAt))) &&
    Boolean(practitionerSignedAt && Number.isFinite(Date.parse(practitionerSignedAt))) &&
    signatureKeys.length > 0;
}
