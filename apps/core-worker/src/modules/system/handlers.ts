import type { RequestContext } from "../../contracts/context";
import { success } from "../../http/response";

function versionPayload(context: RequestContext) {
  return {
    worker: "core",
    environment: context.environment,
    app: context.env.APP_NAME,
    timestamp: new Date().toISOString(),
    version: context.env.APP_VERSION ?? "0.1.0",
    git_sha: context.env.GIT_SHA ?? "unknown",
    mode_model: ["sandbox", "live"],
  };
}

export async function healthHandler(context: RequestContext): Promise<Response> {
  return success(
    {
      ok: true,
      status: "healthy",
      ...versionPayload(context),
    },
    200,
    context,
  );
}

export async function readyHandler(context: RequestContext): Promise<Response> {
  return success(
    {
      ok: true,
      status: "ready",
      ...versionPayload(context),
    },
    200,
    context,
  );
}

export async function versionHandler(context: RequestContext): Promise<Response> {
  return success(versionPayload(context), 200, context);
}
