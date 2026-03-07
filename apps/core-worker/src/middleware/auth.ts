import type { Middleware } from "../http/middleware";
import { unauthorized } from "../http/errors";

function parseBearerSubject(token: string): string {
  const parts = token.split(".");
  if (parts.length < 2) {
    return "jwt_unknown";
  }

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload && typeof payload.sub === "string" && payload.sub.length > 0) {
      return payload.sub;
    }
  } catch {
    return "jwt_unknown";
  }

  return "jwt_unknown";
}

function parseApiKeyHint(apiKey: string): string {
  return `key_${apiKey.slice(0, 8)}`;
}

export const authenticateActorMiddleware: Middleware = async (context, next) => {
  const authorization = context.request.headers.get("authorization");
  const apiKey = context.request.headers.get("x-api-key");

  if (authorization?.startsWith("Bearer ") && apiKey) {
    throw unauthorized(
      "ambiguous_authentication",
      "Use either Bearer token or X-API-Key, not both.",
    );
  }

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      throw unauthorized("invalid_auth_header", "Bearer token is missing.");
    }

    const subject = parseBearerSubject(token);
    context.actor = {
      actor_type: "user",
      actor_id: subject,
      authenticated: true,
      auth_method: "bearer_jwt",
      scopes: [],
      roles: [],
      bound_tenant_id: null,
      credentials: {
        jwt_subject: subject,
        api_key_hint: null,
      },
    };

    return next();
  }

  if (apiKey && apiKey.trim().length > 0) {
    const keyHint = parseApiKeyHint(apiKey);
    const boundTenant = context.request.headers.get("x-api-key-tenant");

    context.actor = {
      actor_type: "api_key",
      actor_id: keyHint,
      authenticated: true,
      auth_method: "api_key",
      scopes: [],
      roles: [],
      bound_tenant_id: boundTenant,
      credentials: {
        jwt_subject: null,
        api_key_hint: keyHint,
      },
    };

    return next();
  }

  context.actor = {
    actor_type: "anonymous",
    actor_id: "anonymous",
    authenticated: false,
    auth_method: "none",
    scopes: [],
    roles: [],
    bound_tenant_id: null,
    credentials: {
      jwt_subject: null,
      api_key_hint: null,
    },
  };

  return next();
};

export const requireAuthenticationMiddleware: Middleware = async (context, next) => {
  if (!context.route_meta.requires_auth) {
    return next();
  }

  if (!context.actor.authenticated) {
    throw unauthorized("authentication_required", "Authentication is required.");
  }

  return next();
};
