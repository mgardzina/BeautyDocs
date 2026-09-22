import { fetchBeautyDocsGoogleLoginConfig } from "@/lib/beautydocs-admin-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET() {
  const result = await fetchBeautyDocsGoogleLoginConfig();
  return result.status === "ok"
    ? beautyDocsBffJson(result.data)
    : beautyDocsBffError("unavailable", 503);
}
