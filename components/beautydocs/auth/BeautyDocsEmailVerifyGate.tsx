"use client";

import { useT } from "../i18n";
import type { FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { BeautyDocsVerifyMailArt } from "./BeautyDocsLockedPanelPreview";
import { BeautyDocsLockedPanelCard } from "./BeautyDocsLockedPanelCard";
import { BeautyDocsCodeInput } from "./BeautyDocsCodeInput";

/**
 * E-mail verification, presented as if the user has already arrived at
 * their panel: a static, non-interactive preview of the real dashboard sits
 * dimmed behind a floating card that asks for the 6-digit code. Used by
 * both the owner and the client sign-up flows so the moment of "you're
 * almost in" looks and feels the same everywhere. This always appears
 * before any onboarding wizard — the panel behind it is a decorative
 * stand-in, not a live session, so nothing here touches real account data
 * until the code is confirmed.
 */
export function BeautyDocsEmailVerifyGate({
  variant,
  email,
  code,
  onCodeChange,
  devCode,
  error,
  pending,
  onSubmit,
  onChangeEmail,
  resendWaiting,
  resent,
  onResend,
}: {
  readonly variant: "owner" | "client";
  readonly email: string;
  readonly code: string;
  readonly onCodeChange: (value: string) => void;
  readonly devCode: string | null;
  readonly error: string | null;
  readonly pending: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onChangeEmail: () => void;
  readonly resendWaiting: boolean;
  readonly resent: boolean;
  readonly onResend: () => void;
}) {
  const t = useT();
  return (
    <BeautyDocsLockedPanelCard variant={variant}>
      <div role="dialog" aria-modal="true" aria-label={t("Potwierdzenie adresu e-mail")}>
        <BeautyDocsVerifyMailArt />
        <form className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8" onSubmit={onSubmit}>
          <h2 className="text-xl font-black tracking-tight text-[#173d35] sm:text-2xl">
            {t("Sprawdź skrzynkę, aby potwierdzić e-mail")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {t("Wysłaliśmy 6-cyfrowy kod na")}{" "}
            <span className="font-semibold text-[#173d35]">{email}</span>{t(". Jeśli go nie widzisz, sprawdź folder spam.")}
          </p>

          <div className="mt-6">
            <BeautyDocsCodeInput disabled={pending} onChange={onCodeChange} value={code} />
          </div>

          {devCode ? (
            <p className="mt-4 rounded-xl bg-[#eaf0e2] px-3 py-2 text-center text-xs text-[#426447]">
              {t("Tryb testowy — Twój kod to")}{" "}
              <span className="font-black tracking-widest">{devCode}</span>
            </p>
          ) : null}

          {error ? (
            <p
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#245c4d] px-4 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(36,92,77,0.18)] transition hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            disabled={pending}
            type="submit"
          >
            {pending ? t("Weryfikacja…") : t("Potwierdź adres e-mail")}
            {pending ? null : <ArrowRight aria-hidden="true" className="size-4" />}
          </button>

          <button
            className="mt-4 block w-full text-center text-sm font-bold text-[#245c4d] underline-offset-4 hover:underline focus-visible:outline-none"
            disabled={pending}
            onClick={onChangeEmail}
            type="button"
          >
            {t("Zmień adres e-mail")}
          </button>
        </form>

        <div className="border-t border-[#eaeee4] bg-[#fbfcf8] px-6 py-4 text-center sm:px-8">
          {resent ? (
            <p className="mb-2 text-xs font-bold text-[#426447]">
              {t("Nowy kod został wysłany.")}
            </p>
          ) : null}
          <button
            className="text-sm font-bold text-[#245c4d] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
            disabled={pending || resendWaiting}
            onClick={onResend}
            type="button"
          >
            {resendWaiting ? t("Kolejna wysyłka za minutę") : t("Wyślij kod ponownie")}
          </button>
        </div>
      </div>
    </BeautyDocsLockedPanelCard>
  );
}
