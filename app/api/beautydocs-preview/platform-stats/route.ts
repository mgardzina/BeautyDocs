import { NextResponse } from "next/server";
import { fetchPlatformStats } from "@/lib/beautydocs-api";

export async function GET() {
  const result = await fetchPlatformStats();
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
