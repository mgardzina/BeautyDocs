"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Only the legacy PowderBrows admin panel (`/admin/**`) uses the NextAuth
  // session. Everything else — the BeautyDocs 2.0 app and marketing pages —
  // uses the API-backed HttpOnly session, so it must NOT mount SessionProvider
  // (its `/api/auth/session` poll 500s when NextAuth is not configured).
  if (pathname.startsWith("/admin")) {
    return <SessionProvider>{children}</SessionProvider>;
  }

  return children;
}
