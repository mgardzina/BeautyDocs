"use client";

import { useState, type ReactNode } from "react";

const defaultButtonClassName =
  "rounded-xl border border-[#d4decc] bg-white px-3 py-2 text-sm font-bold text-[#6a8a6e] transition hover:border-[#b8cbaa] hover:bg-[#f5f8f2] hover:text-[#173d35] disabled:cursor-wait disabled:opacity-60";

export function BeautyDocsLogoutButton({
  className = defaultButtonClassName,
  icon,
  label = "Wyloguj",
}: {
  readonly className?: string;
  readonly icon?: ReactNode;
  readonly label?: string;
} = {}) {
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function logout() {
    setIsPending(true);
    setHasError(false);

    try {
      const response = await fetch("/api/beautydocs-preview/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setHasError(true);
        return;
      }

      window.location.assign("/panel");
    } catch {
      setHasError(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="text-right">
      <button
        className={className}
        disabled={isPending}
        onClick={logout}
        type="button"
      >
        {isPending ? null : icon}
        {isPending ? "Wylogowywanie…" : label}
      </button>
      {hasError ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          Nie udało się wylogować.
        </p>
      ) : null}
    </div>
  );
}
