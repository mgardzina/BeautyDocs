"use client";

import { useT } from "../i18n";
import { BeautyDocsDialog } from "../BeautyDocsDialog";
import { Check, Copy, Download, QrCode, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState } from "react";

export function BeautyDocsFormQrDialog({
  tenantSlug,
  formCode,
  formName,
}: {
  readonly tenantSlug: string;
  readonly formCode: string;
  readonly formName: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const url = `${origin}/f/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(formCode)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the link stays visible to copy manually.
    }
  };

  const handleDownload = () => {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${formCode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#dce1d4] bg-white px-3 py-1.5 text-xs font-black text-[#245c4d] transition hover:border-[#b8cbaa] hover:bg-[#f8faf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
        onClick={() => { setOrigin(window.location.origin); setCopied(false); setOpen(true); }}
        type="button"
      >
        <QrCode aria-hidden="true" className="size-4" />
        {t("Kod QR")}
      </button>

      <BeautyDocsDialog open={open} onClose={() => setOpen(false)} title={t("Kod QR: {formName}", { formName: formName })} className="max-w-sm">
          <div
            className="w-full max-w-sm rounded-[1.75rem] border border-[#e5eadf] bg-white p-6 shadow-[0_24px_70px_rgba(38,65,58,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
                  {t("Kod QR formularza")}
                </p>
                <h2
                  className="mt-1 truncate text-lg font-black text-[#173d35]"
                  id="qr-dialog-title"
                >
                  {formName}
                </h2>
              </div>
              <button
                aria-label={t("Zamknij")}
                className="grid size-11 shrink-0 place-items-center rounded-full text-[#808f82] transition hover:bg-[#eff4e7] hover:text-[#173d35]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div
              className="mx-auto mt-5 w-fit rounded-2xl border border-[#e7ecdf] bg-white p-4"
              ref={wrapperRef}
            >
              {origin ? (
                <QRCodeCanvas
                  bgColor="#ffffff"
                  fgColor="#173d35"
                  level="M"
                  marginSize={2}
                  size={208}
                  value={url}
                />
              ) : (
                <div className="size-[208px]" />
              )}
            </div>

            <p className="mt-4 text-center text-sm text-[#5a6b5a]">
              {t("Klientka skanuje kod telefonem i od razu otwiera ten formularz.")}
            </p>

            <p className="mt-3 break-all rounded-xl bg-[#f8faf5] px-3 py-2 text-center text-xs font-bold text-[#245c4d]">
              {url}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dce1d4] bg-white px-4 py-2.5 text-sm font-black text-[#245c4d] transition hover:border-[#b8cbaa] hover:bg-[#f8faf4]"
                onClick={handleCopy}
                type="button"
              >
                {copied ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : (
                  <Copy aria-hidden="true" className="size-4" />
                )}
                {copied ? t("Skopiowano") : t("Kopiuj link")}
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#245c4d] px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(36,92,77,0.22)] transition hover:bg-[#173d35]"
                onClick={handleDownload}
                type="button"
              >
                <Download aria-hidden="true" className="size-4" />
                {t("Pobierz PNG")}
              </button>
            </div>
          </div>
      </BeautyDocsDialog>
    </>
  );
}
