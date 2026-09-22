import { NextRequest } from "next/server";
import { fetchBeautyDocsMfaState } from "@/lib/beautydocs-admin-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const result = await fetchBeautyDocsMfaState(request.headers.get("cookie"));
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  if (result.status === "unauthorized") {
    return beautyDocsBffError("authentication_required", 401);
  }
  return beautyDocsBffError("unavailable", 503);
}
