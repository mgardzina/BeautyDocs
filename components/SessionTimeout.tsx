"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";

export default function SessionTimeout() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !session?.expires ||
      pathname === "/admin/login"
    ) {
      return;
    }

    let expired = false;
    const refresh = () => {
      const now = Date.now();
      const expires = new Date(session.expires).getTime();
      const diff = expires - now;
      if (!Number.isFinite(diff)) return;

      if (diff <= 0) {
        if (!expired) {
          expired = true;
          void signOut({ callbackUrl: "/admin/login" });
        }
        return;
      }

      setMinutesLeft(Math.ceil(diff / 60_000));
    };
    refresh();
    const intervalId = setInterval(refresh, 1000);

    return () => clearInterval(intervalId);
  }, [session, status, pathname]);

  if (status !== "authenticated" || pathname === "/admin/login") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {minutesLeft !== null && minutesLeft <= 5 ? (
        <div className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Clock aria-hidden="true" className="size-5 shrink-0" />
          <span>Sesja wygaśnie za {minutesLeft} min. Zapisz rozpoczęte zmiany przed wylogowaniem.</span>
        </div>
      ) : null}
    </div>
  );
}
