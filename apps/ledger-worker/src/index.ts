interface LedgerCommand {
  event_id?: string;
  event_type?: string;
  tenant_id?: string;
  mode?: "sandbox" | "live";
  data?: Record<string, unknown>;
}

interface Env {
  DB: D1Database;
  Q_LEDGER_EVENTS: Queue;
  ENVIRONMENT: "local" | "dev" | "staging" | "prod";
  APP_NAME: string;
  APP_VERSION?: string;
  GIT_SHA?: string;
}

interface WorkerStatus {
  ok: boolean;
  status: "healthy" | "ready";
  worker: "ledger";
  environment: Env["ENVIRONMENT"];
  app: string;
  timestamp: string;
  version: string;
  git_sha: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function statusPayload(env: Env, status: WorkerStatus["status"]): WorkerStatus {
  return {
    ok: true,
    status,
    worker: "ledger",
    environment: env.ENVIRONMENT,
    app: env.APP_NAME,
    timestamp: new Date().toISOString(),
    version: env.APP_VERSION ?? "0.1.0",
    git_sha: env.GIT_SHA ?? "unknown",
  };
}

function versionPayload(env: Env) {
  return {
    worker: "ledger",
    environment: env.ENVIRONMENT,
    app: env.APP_NAME,
    timestamp: new Date().toISOString(),
    version: env.APP_VERSION ?? "0.1.0",
    git_sha: env.GIT_SHA ?? "unknown",
    mode_model: ["sandbox", "live"],
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/health") {
      return json(statusPayload(env, "healthy"));
    }

    if (pathname === "/ready") {
      return json(statusPayload(env, "ready"));
    }

    if (pathname === "/version") {
      return json(versionPayload(env));
    }

    return json(
      {
        error: {
          type: "invalid_request_error",
          code: "route_not_found",
          message: "Route is not implemented yet.",
        },
      },
      404,
    );
  },

  async queue(batch: MessageBatch<LedgerCommand>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body;

      if (!body || typeof body !== "object") {
        message.retry();
        continue;
      }

      await env.Q_LEDGER_EVENTS.send({
        event_id: body.event_id ?? crypto.randomUUID(),
        event_type: body.event_type ?? "ledger.journal_posted",
        tenant_id: body.tenant_id,
        mode: body.mode,
        resources: {},
        data: body.data ?? {},
      });

      message.ack();
    }
  },
};
