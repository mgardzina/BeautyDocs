"use client";

import { useT } from "./i18n";
import { Dialog } from "radix-ui";
import { useRef, type ReactNode } from "react";

/** Shared modal: traps focus, dismisses on Escape and restores the opener. */
export function BeautyDocsDialog({
  open,
  onClose,
  title,
  children,
  className = "max-w-2xl",
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const t = useT();
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="bd-dialog-overlay fixed inset-0 z-[100] overflow-y-auto bg-[#173d35]/40 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <Dialog.Content
              aria-describedby={undefined}
              className={`bd-dialog-content relative w-full outline-none ${className}`}
              onOpenAutoFocus={() => {
                opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              }}
              onCloseAutoFocus={(event) => {
                if (opener.current?.isConnected) {
                  event.preventDefault();
                  opener.current.focus();
                }
              }}
            >
              <Dialog.Title className="sr-only">{t(title)}</Dialog.Title>
              {children}
            </Dialog.Content>
          </div>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
