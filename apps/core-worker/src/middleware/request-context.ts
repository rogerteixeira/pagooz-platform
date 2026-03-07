import type { RequestContext } from "../contracts/context";
import type { CoreEnv } from "../contracts/environment";
import type { CoreServices } from "../services/types";

export function createRequestContext(options: {
  request: Request;
  env: CoreEnv;
  services: CoreServices;
  route_meta: RequestContext["route_meta"];
}): RequestContext {
  const incomingRequestId = options.request.headers.get("x-request-id");
  const incomingTraceId = options.request.headers.get("x-trace-id");

  const requestId = incomingRequestId && incomingRequestId.length > 0
    ? incomingRequestId
    : crypto.randomUUID();

  const traceId = incomingTraceId && incomingTraceId.length > 0
    ? incomingTraceId
    : requestId;

  return {
    request: options.request,
    env: options.env,
    services: options.services,
    request_id: requestId,
    trace_id: traceId,
    tenant_id: null,
    mode: null,
    locale: options.env.DEFAULT_LOCALE,
    environment: options.env.ENVIRONMENT,
    actor: {
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
    },
    idempotency_key: null,
    audit: {
      record: async () => undefined,
    },
    route_meta: options.route_meta,
  };
}
