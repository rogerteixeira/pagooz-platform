import type { Middleware } from "../http/middleware";
import { forbidden } from "../http/errors";

export const rbacMiddleware: Middleware = async (context, next) => {
  const rawRoles = context.request.headers.get("x-roles");
  context.actor.roles = rawRoles
    ? rawRoles
        .split(",")
        .map((role) => role.trim())
        .filter((role) => role.length > 0)
    : [];

  const rawScopes = context.request.headers.get("x-scopes");
  context.actor.scopes = rawScopes
    ? rawScopes
        .split(",")
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0)
    : [];

  if (!context.route_meta.requires_auth) {
    return next();
  }

  if (
    context.actor.auth_method === "api_key" &&
    context.actor.bound_tenant_id &&
    context.tenant_id &&
    context.actor.bound_tenant_id !== context.tenant_id
  ) {
    throw forbidden(
      "api_key_tenant_mismatch",
      "API key is not bound to the requested tenant.",
    );
  }

  const requiredScopes = context.route_meta.required_scopes;
  if (requiredScopes.length > 0 && !context.actor.roles.includes("admin")) {
    const granted = new Set(context.actor.scopes);
    const missing = requiredScopes.filter((scope) => !granted.has(scope));

    if (missing.length > 0) {
      throw forbidden(
        "insufficient_scope",
        `Missing required scopes: ${missing.join(", ")}`,
      );
    }
  }

  return next();
};
