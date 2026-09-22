import { fetchConsumerGoogleLoginConfig } from "@/lib/beautydocs-consumer-api";
import { beautyDocsBffError, beautyDocsBffJson } from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET() {
  const result = await fetchConsumerGoogleLoginConfig();
  if (result.status === "ok") return beautyDocsBffJson(result.data);
  return beautyDocsBffError("unavailable", 503);
}
