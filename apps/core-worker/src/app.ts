import type { CoreEnv } from "./contracts/environment";
import { normalizeError } from "./http/errors";
import { composeMiddleware } from "./http/middleware";
import { error } from "./http/response";
import { buildRoutes } from "./http/routes";
import { createRouter } from "./http/router";
import {
  authenticateActorMiddleware,
  requireAuthenticationMiddleware,
} from "./middleware/auth";
import { auditHookMiddleware } from "./middleware/audit";
import { idempotencyMiddleware } from "./middleware/idempotency";
import { localeMiddleware } from "./middleware/locale";
import { createRequestContext } from "./middleware/request-context";
import { rbacMiddleware } from "./middleware/rbac";
import { tenantModeMiddleware } from "./middleware/tenant-mode";
import { traceMiddleware } from "./middleware/trace";
import {
  createRuntimeDependencies,
  createServices,
  type ServiceContainerDependencies,
} from "./services/container";

const DEFAULT_ROUTE_META = {
  requires_tenant_mode: false,
  requires_auth: false,
  requires_idempotency: false,
  required_scopes: [],
} as const;

const pipeline = [
  traceMiddleware,
  localeMiddleware,
  tenantModeMiddleware,
  authenticateActorMiddleware,
  requireAuthenticationMiddleware,
  rbacMiddleware,
  idempotencyMiddleware,
  auditHookMiddleware,
];

export function createCoreWorker(options?: {
  dependencies_factory?: (
    env: CoreEnv,
  ) => ServiceContainerDependencies;
}) {
  const router = createRouter(buildRoutes());

  return {
    async fetch(request: Request, env: CoreEnv): Promise<Response> {
      const dependencies =
        options?.dependencies_factory?.(env) ?? createRuntimeDependencies(env);

      const services = createServices(env, dependencies);

      const context = createRequestContext({
        request,
        env,
        services,
        route_meta: DEFAULT_ROUTE_META,
      });

      try {
        const pathname = new URL(request.url).pathname;
        const matched = router.match(request.method as "GET" | "POST", pathname);

        context.route_meta = matched.route.meta;

        const run = composeMiddleware(pipeline, async (ctx) =>
          matched.route.handler(ctx, matched.params),
        );

        return await run(context);
      } catch (errorValue) {
        const appError = normalizeError(errorValue);
        return error(appError.toBody(), appError.status, context);
      }
    },
  };
}
