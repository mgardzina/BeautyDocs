import { NextRequest, NextResponse } from "next/server";
import { resolveBeautyDocsInternalApiUrl } from "@/lib/beautydocs-internal-api";
import { isValidTenantSlug } from "@/lib/tenant-host";

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const valid = path.length === 0 || (isValidTenantSlug(path[0]) && (path.length === 1 || (path.length === 2 && path[1] === "logo") || (path.length === 3 && path[1] === "photos" && /^[0-5]$/.test(path[2]))));
  if (!valid) return new NextResponse(null, { status: 404 });
  const url = resolveBeautyDocsInternalApiUrl(`/api/v1/public/salons${path.length ? "/" + path.join("/") : ""}`);
  if (!url) return new NextResponse(null, { status: 503 });
  for (const key of ["query", "offset"]) { const value = request.nextUrl.searchParams.get(key); if (value) url.searchParams.set(key, value); }
  try {
    const response = await fetch(url, { cache: "no-store", headers: { host: "app.beautydocs.pl" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return NextResponse.json({ error: "unavailable" }, { status: response.status === 404 ? 404 : response.status === 422 ? 422 : 503 });
    return new NextResponse(response.body, { headers: { "Content-Type": path.length >= 2 ? (response.headers.get("content-type") || "image/jpeg") : "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 503 }); }
}
