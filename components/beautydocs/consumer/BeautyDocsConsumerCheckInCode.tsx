"use client";

import { useT } from "../i18n";
import { QrCode, RefreshCw } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A rotating check-in QR the client shows at the salon. The salon scans it to
 * confirm the client and open her file. The code is a short-lived signed token
 * that refreshes automatically before it expires, so a photographed code stops
 * working — no personal data is encoded, only the signed token.
 */
export function BeautyDocsConsumerCheckInCode() {
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const response = await fetch(
        "/api/beautydocs-preview/consumer/check-in-token",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      if (!response.ok) {
        setError(t("Nie udało się pobrać kodu. Spróbuj ponownie."));
        return;
      }
      const data = (await response.json()) as {
        token?: unknown;
        expiresInSeconds?: unknown;
      };
      if (typeof data.token !== "string") {
        setError(t("Kod jest chwilowo niedostępny."));
        return;
      }
      const ttl =
        typeof data.expiresInSeconds === "number" ? data.expiresInSeconds : 90;
      setToken(data.token);
      setExpiresAt(Date.now() + ttl * 1000);
      setError(null);
    } catch {
      setError(t("Kod jest chwilowo niedostępny."));
    } finally {
      pending.current = false;
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  useEffect(() => {
    if (token && secondsLeft <= 5) void refresh();
  }, [token, secondsLeft, refresh]);

  return (
    <section className="rounded-3xl border border-[#e5eadf] bg-white p-6 sm:p-7">
      <div className="flex items-center gap-2 text-[#245c4d]">
        <QrCode aria-hidden="true" className="size-5" />
        <h2 className="text-sm font-black uppercase tracking-[0.14em]">
          {t("Mój kod check-in")}
        </h2>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {t("Pokaż ten kod w salonie — pracownik zeskanuje go, aby Cię potwierdzić i otworzyć Twoją dokumentację.")}
      </p>

      <div className="mt-5 flex flex-col items-center">
        <div className="rounded-2xl border border-[#e7ecdf] bg-white p-4">
          {token && !error ? (
            <QRCodeCanvas
              bgColor="#ffffff"
              fgColor="#173d35"
              level="M"
              marginSize={2}
              size={208}
              value={token}
            />
          ) : (
            <div className="grid size-[208px] place-items-center text-sm text-stone-400">
              {error ?? t("Ładowanie…")}
            </div>
          )}
        </div>

        {error ? (
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#dce1d4] bg-white px-4 py-2 text-sm font-black text-[#245c4d] transition hover:border-[#b8cbaa] hover:bg-[#f8faf4]"
            onClick={() => void refresh()}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="size-4" />{" "}{t("Odśwież kod")}
          </button>
        ) : (
          <p className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#96a298]">
            <RefreshCw aria-hidden="true" className="size-3.5" />
            {t("Kod odświeża się automatycznie (")}{secondsLeft}{t("s)")}
          </p>
        )}
      </div>
    </section>
  );
}
