import type { ZodType } from "zod";
import { invalidRequest } from "./errors";

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw invalidRequest("invalid_json", "Request body must be valid JSON.");
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw invalidRequest("invalid_request", result.error.issues[0]?.message ?? "Invalid request.");
  }

  return result.data;
}

export function parseQuery<T>(url: URL, schema: ZodType<T>): T {
  const queryObject: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    queryObject[key] = value;
  });

  const result = schema.safeParse(queryObject);
  if (!result.success) {
    throw invalidRequest("invalid_query", result.error.issues[0]?.message ?? "Invalid query.");
  }

  return result.data;
}
