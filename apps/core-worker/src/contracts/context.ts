import type { CoreEnv, InfrastructureEnvironment, Mode } from "./environment";
import type { CoreServices } from "../services/types";

export interface ActorContext {
  actor_type: "anonymous" | "user" | "api_key";
  actor_id: string;
  authenticated: boolean;
  auth_method: "none" | "bearer_jwt" | "api_key";
  scopes: string[];
  roles: string[];
  bound_tenant_id: string | null;
  credentials: {
    jwt_subject: string | null;
    api_key_hint: string | null;
  };
}

export interface AuditHook {
  record: (event: {
    action: string;
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
    status_code?: number;
  }) => Promise<void>;
}

export interface RequestContext {
  request: Request;
  env: CoreEnv;
  services: CoreServices;
  request_id: string;
  trace_id: string;
  tenant_id: string | null;
  mode: Mode | null;
  locale: string;
  environment: InfrastructureEnvironment;
  actor: ActorContext;
  idempotency_key: string | null;
  audit: AuditHook;
  route_meta: {
    requires_tenant_mode: boolean;
    requires_auth: boolean;
    requires_idempotency: boolean;
    required_scopes: readonly string[];
    allow_operational_bypass: boolean;
  };
}
