import { NextRequest } from "next/server";
import {
  fetchConsumerChats,
  startConsumerChat,
  type ConsumerApiResult,
} from "@/lib/beautydocs-consumer-api";
import {
  beautyDocsBffError,
  beautyDocsBffJson,
  getValidatedBrowserOrigin,
  readSmallJsonBody,
} from "@/lib/beautydocs-bff-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return chatResponse(await fetchConsumerChats(request.headers.get("cookie")));
}

export async function POST(request: NextRequest) {
  const origin = getValidatedBrowserOrigin(request);
  if (origin === null) return beautyDocsBffError("forbidden", 403);
  try {
    const value = (await readSmallJsonBody(request)) as Record<string, unknown>;
    if (typeof value.tenantSlug !== "string" || typeof value.body !== "string") {
      throw new Error("invalid chat");
    }
    return chatResponse(
      await startConsumerChat(
        { tenantSlug: value.tenantSlug, body: value.body },
        request.headers.get("cookie"),
        origin,
      ),
      201,
    );
  } catch {
    return beautyDocsBffError("invalid_request", 422);
  }
}

function chatResponse(result: ConsumerApiResult<unknown>, successStatus = 200) {
  if (result.status === "ok") {
    return beautyDocsBffJson(result.data, {
      setCookie: result.setCookie,
      status: successStatus,
    });
  }
  if (result.status === "unauthorized") return beautyDocsBffError("authentication_required", 401);
  if (result.status === "forbidden") return beautyDocsBffError("forbidden", 403);
  if (result.status === "not-found") return beautyDocsBffError("not_found", 404);
  if (result.status === "invalid") return beautyDocsBffError("invalid_request", 422);
  return beautyDocsBffError("unavailable", 503);
}
