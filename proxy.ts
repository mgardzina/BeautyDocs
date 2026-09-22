import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Next 16 "proxy" convention (replaces the deprecated `middleware` file).
// Proxy always runs on the Node.js runtime, so no `runtime` export is allowed.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginPage = req.nextUrl.pathname === "/admin/login";

  // Jeśli to strona logowania i użytkownik jest zalogowany - przekieruj na dashboard
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Jeśli to strona admina (nie login) i użytkownik nie jest zalogowany - przekieruj na login
  if (isAdminRoute && !isLoginPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
