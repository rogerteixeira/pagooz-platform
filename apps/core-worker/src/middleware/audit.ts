import type { Middleware } from "../http/middleware";

export const auditHookMiddleware: Middleware = async (context, next) => {
  context.audit = {
    record: async () => undefined,
  };

  const response = await next();

  await context.audit.record({
    action: `${context.request.method} ${new URL(context.request.url).pathname}`,
    metadata: {
      request_id: context.request_id,
      actor_type: context.actor.actor_type,
      actor_id: context.actor.actor_id,
    },
    status_code: response.status,
  });

  return response;
};
