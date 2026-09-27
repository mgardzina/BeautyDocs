"use client";

import { useT } from "../i18n";
import { useCallback, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Download, LoaderCircle } from "lucide-react";

interface BeautyDocsSignaturePadProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (signature: string) => void;
  readonly required?: boolean;
  readonly date?: string;
  readonly disabled?: boolean;
  readonly onUseSavedSignature?: () => void;
  readonly savedSignatureLoading?: boolean;
}

/**
 * Signature capture ported from the legacy SignaturePad and
 * restyled to cherry/cream. Emits the drawing as a PNG data URL.
 */
export function BeautyDocsSignaturePad({
  label,
  value,
  onChange,
  required,
  date,
  disabled = false,
  onUseSavedSignature,
  savedSignatureLoading = false,
}: BeautyDocsSignaturePadProps) {
  const t = useT();
  const sigCanvas = useRef<SignatureCanvas>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const locallyEmittedValueRef = useRef("");

  const resizeCanvas = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = sigCanvas.current?.getCanvas();
    if (!wrapper || !canvas) return;
    const { width, height } = wrapper.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const data = sigCanvas.current?.toDataURL("image/png");
    canvas.width = width;
    canvas.height = height;
    if (data && data !== "data:,") {
      sigCanvas.current?.fromDataURL(data, { width, height });
    }
  }, []);

  useEffect(() => {
    if (value === locallyEmittedValueRef.current) return;
    locallyEmittedValueRef.current = value;
    const timer = window.setTimeout(() => {
      if (!sigCanvas.current) return;
      sigCanvas.current.clear();
      if (value) sigCanvas.current.fromDataURL(value);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(wrapper);
    resizeCanvas();
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const handleClear = () => {
    sigCanvas.current?.clear();
    locallyEmittedValueRef.current = "";
    onChange("");
  };

  const handleEnd = () => {
    if (sigCanvas.current) {
      const signature = sigCanvas.current.toDataURL("image/png");
      locallyEmittedValueRef.current = signature;
      onChange(signature);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#6e8471]">
          {t(label)} {required ? <span className="text-[#245c4d]">*</span> : null}
        </label>
        {onUseSavedSignature ? (
          <button
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#d0d9c4] bg-white px-3 py-2 text-xs font-black text-[#245c4d] shadow-sm transition hover:border-[#aabc92] hover:bg-[#f4f8ef] disabled:cursor-wait disabled:opacity-60"
            disabled={disabled || savedSignatureLoading}
            onClick={onUseSavedSignature}
            type="button"
          >
            {savedSignatureLoading ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-3.5" />
            )}
            {savedSignatureLoading
              ? t("Wczytuję podpis…")
              : t("Użyj zapisanego podpisu")}
          </button>
        ) : null}
      </div>

      <div className="group relative">
        <div
          className="relative h-[220px] w-full overflow-hidden rounded-[22px] border border-[#dfe4d8] bg-[#fafbf9] transition focus-within:border-[#bbc9a8] focus-within:ring-4 focus-within:ring-[#245c4d]/10"
          ref={wrapperRef}
        >
          <SignatureCanvas
            backgroundColor="rgba(0,0,0,0)"
            canvasProps={{
              style: {
                width: "100%",
                height: "100%",
                display: "block",
                touchAction: "none",
                pointerEvents: disabled ? "none" : "auto",
              },
            }}
            maxWidth={2.5}
            minWidth={1}
            onEnd={handleEnd}
            penColor="#173d35"
            ref={sigCanvas}
          />

          {!disabled ? (
            <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                className="rounded-lg border border-[#e1e6da] bg-white/90 px-2.5 py-1.5 text-[11px] font-bold text-[#245c4d] shadow-sm backdrop-blur transition hover:bg-white hover:text-[#245c4d]"
                onClick={handleClear}
                type="button"
              >
                {t("Wyczyść")}
              </button>
            </div>
          ) : null}

          {!value ? (
            <div className="pointer-events-none absolute inset-x-5 bottom-6 z-0 select-none border-t border-dashed border-[#d2d9c8] pt-2 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#aeb7a2]">
                {t("Podpisz tutaj")}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {date ? (
        <p className="mt-1 text-right font-serif text-xs italic text-[#5a6b5a]">{date}</p>
      ) : null}
    </div>
  );
}
