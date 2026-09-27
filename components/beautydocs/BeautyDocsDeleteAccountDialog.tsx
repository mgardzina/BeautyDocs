"use client";

import { useT } from "./i18n";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import { BeautyDocsDialog } from "./BeautyDocsDialog";
import { BeautyDocsAccountDeletionArt } from "./BeautyDocsAccountDeletionArt";

/**
 * Destructive-action confirmation for deleting an account: an illustration
 * and a short checklist of consequences the person has to actively confirm,
 * instead of typing a confirmation phrase. When `blockedReason` is set
 * (e.g. an owner still has an active salon), the checklist is replaced by a
 * clear, actionable notice — so the person finds out why they can't delete
 * their account before they try, not after a failed request.
 */
export function BeautyDocsDeleteAccountDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
  title = "Czy na pewno chcesz usunąć konto?",
  consequences,
  blockedReason,
  blockedItems,
  blockedActionLabel,
  onBlockedAction,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly error: string | null;
  readonly title?: string;
  readonly consequences: readonly string[];
  /** When set, deletion is blocked and this explains why instead of the checklist. */
  readonly blockedReason?: string | null;
  readonly blockedItems?: readonly string[];
  readonly blockedActionLabel?: string;
  readonly onBlockedAction?: () => void;
}) {
  const t = useT();
  const [checked, setChecked] = useState<boolean[]>(() => consequences.map(() => false));

  useEffect(() => {
    if (open) setChecked(consequences.map(() => false));
    // Reset the checklist each time the dialog opens, so re-opening after
    // "Nevermind" never leaves it pre-confirmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allChecked = checked.length > 0 && checked.every(Boolean);

  return (
    <BeautyDocsDialog className="max-w-xl" onClose={onClose} open={open} title={t(title)}>
      <div className="overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-6 sm:p-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black tracking-tight text-[#173d35] sm:text-2xl">
              {t(title)}
            </h2>
            {!blockedReason ? (
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {t("Kontynuowanie usunięcia wymaga potwierdzenia poniższych informacji.")}
              </p>
            ) : null}
          </div>
          <BeautyDocsAccountDeletionArt className="hidden h-24 w-28 shrink-0 sm:block" />
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {blockedReason ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <p className="font-black text-amber-950">{blockedReason}</p>
                  {blockedItems && blockedItems.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-sm text-amber-900">
                      {blockedItems.map((item) => (
                        <li className="flex items-center gap-2" key={item}>
                          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              {onBlockedAction ? (
                <button
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-amber-700"
                  onClick={onBlockedAction}
                  type="button"
                >
                  {blockedActionLabel ?? t("Przejdź do ustawień salonu")}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2.5">
              {consequences.map((label, index) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f7f8f4] px-4 py-3.5 transition hover:bg-[#eef3e7]"
                  key={label}
                >
                  <input
                    checked={checked[index] ?? false}
                    className="mt-0.5 size-5 shrink-0 accent-[#245c4d]"
                    onChange={(event) =>
                      setChecked((current) => {
                        const next = [...current];
                        next[index] = event.target.checked;
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                  <span className="text-sm leading-6 text-[#173d35]">{t(label)}</span>
                </label>
              ))}
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3 border-t border-[#eaeee4] pt-6">
            <button
              className="rounded-2xl border border-[#d4decc] bg-white px-5 py-3 text-sm font-black text-[#173d35] transition hover:bg-[#f7f8f4]"
              onClick={onClose}
              type="button"
            >
              {t("Nie teraz")}
            </button>
            {!blockedReason ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!allChecked || pending}
                onClick={onConfirm}
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {pending ? t("Usuwanie…") : t("Usuń moje konto")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </BeautyDocsDialog>
  );
}
