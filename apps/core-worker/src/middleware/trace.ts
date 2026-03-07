import type { Middleware } from "../http/middleware";

export const traceMiddleware: Middleware = async (context, next) => {
  const cfRay = context.request.headers.get("cf-ray");
  if (cfRay && context.trace_id === context.request_id) {
    context.trace_id = cfRay;
  }

  return next();
};
