"use client";

import { BeautyDocsDialog } from "../BeautyDocsDialog";
import { X } from "lucide-react";

interface BeautyDocsDocumentModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly salonName: string;
  readonly content: string;
  readonly legalNote?: string | null;
}

/**
 * Full-content preview of a consent/legal document. The white "paper" card
 * floats in front of the page over a blurred, dimmed backdrop — like looking at
 * an opened file. Closes on backdrop click, the X button, or Escape.
 */
export function BeautyDocsDocumentModal({
  open,
  onClose,
  title,
  salonName,
  content,
  legalNote,
}: BeautyDocsDocumentModalProps) {
  const paragraphs = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <BeautyDocsDialog open={open} onClose={onClose} title={title}>
      <div className="relative flex max-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_40px_120px_rgba(23,61,53,0.38)] ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4 sm:px-9">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#245c4d]">
            Podgląd dokumentu
          </p>
          <button
            aria-label="Zamknij"
            className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-7 sm:px-9 sm:py-9">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
            {salonName}
          </p>
          <h2
            className="mt-2 font-serif text-2xl leading-tight tracking-tight text-[#173d35] sm:text-3xl"
            id="document-modal-title"
          >
            {title}
          </h2>

          <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#173d35]">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p>{content}</p>
            )}
          </div>

          {legalNote ? (
            <p className="mt-8 border-t border-stone-100 pt-5 text-xs italic leading-6 text-stone-500">
              {legalNote}
            </p>
          ) : null}
        </div>
      </div>
    </BeautyDocsDialog>
  );
}
