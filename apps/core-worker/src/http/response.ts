import type { RequestContext } from "../contracts/context";
import type { ApiErrorBody } from "../contracts/api";

function withCommonHeaders(response: Response, context: RequestContext | null): Response {
  if (!context) {
    return response;
  }

  response.headers.set("x-request-id", context.request_id);
  response.headers.set("x-trace-id", context.trace_id);
  response.headers.set("x-environment", context.environment);
  return response;
}

export function jsonResponse(
  data: unknown,
  status: number,
  context: RequestContext | null,
): Response {
  const response = new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

  return withCommonHeaders(response, context);
}

export function success(
  data: unknown,
  status: number,
  context: RequestContext | null,
): Response {
  return jsonResponse(data, status, context);
}

export function error(
  body: ApiErrorBody,
  status: number,
  context: RequestContext | null,
): Response {
  return jsonResponse(body, status, context);
}
