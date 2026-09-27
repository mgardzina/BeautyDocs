"use client";
import { useT } from "../i18n";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export function BeautyDocsPdfDownload({ href, documentId, eligible }: { href: string; documentId: string; eligible: boolean }) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    if (pending || !eligible) return;
    setPending(true); setError(null);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (response.status === 409) {
        setError(t("PDF będzie dostępny po podpisaniu formularza przez obie strony."));
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error("PDF unavailable");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `BeautyDocs-${documentId}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError(t("Nie udało się pobrać PDF. Spróbuj ponownie.")); }
    finally { setPending(false); }
  }
  return <div>
    <button type="button" disabled={pending || !eligible} onClick={download} aria-busy={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d4decc] bg-white px-4 py-2.5 text-sm font-semibold text-[#173d35] hover:bg-[#f4f6f1] active:bg-[#e8eedf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
      {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden className="size-4" />}
      <span aria-live="polite">{pending ? t("Przygotowujemy PDF…") : t("Pobierz PDF")}</span>
    </button>
    {!eligible && <p className="mt-2 max-w-xs text-xs text-stone-500">{t("PDF będzie dostępny po podpisaniu formularza przez obie strony.")}</p>}
    {error && <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">{error}</p>}
  </div>;
}
