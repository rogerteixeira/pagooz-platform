import type { Middleware } from "../http/middleware";
import { invalidRequest } from "../http/errors";

export const idempotencyMiddleware: Middleware = async (context, next) => {
  if (!context.route_meta.requires_idempotency) {
    return next();
  }

  const key = context.request.headers.get("idempotency-key");

  if (!key || key.trim().length === 0) {
    throw invalidRequest(
      "missing_idempotency_key",
      "Idempotency-Key header is required for this request.",
    );
  }

  if (key.length > 255) {
    throw invalidRequest(
      "invalid_idempotency_key",
      "Idempotency-Key must be 255 characters or fewer.",
    );
  }

  context.idempotency_key = key;
  return next();
};
