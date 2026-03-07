import type { Middleware } from "../http/middleware";
import { invalidRequest } from "../http/errors";

function normalizeMode(value: string | null): "sandbox" | "live" | null {
  if (!value) {
    return null;
  }

  if (value === "sandbox" || value === "live") {
    return value;
  }

  return null;
}

export const tenantModeMiddleware: Middleware = async (context, next) => {
  if (!context.route_meta.requires_tenant_mode) {
    return next();
  }

  const url = new URL(context.request.url);

  const tenantId =
    context.request.headers.get("x-tenant-id") ??
    context.request.headers.get("x-pagooz-tenant") ??
    url.searchParams.get("tenant_id");

  if (!tenantId) {
    throw invalidRequest("missing_tenant", "Tenant could not be resolved.");
  }

  const modeInput =
    context.request.headers.get("x-mode") ??
    context.request.headers.get("x-pagooz-mode") ??
    url.searchParams.get("mode");

  const mode = normalizeMode(modeInput);
  if (!mode) {
    throw invalidRequest("missing_mode", "Mode must be 'sandbox' or 'live'.");
  }

  context.tenant_id = tenantId;
  context.mode = mode;

  return next();
};
