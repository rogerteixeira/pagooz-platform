import type { LedgerEnv } from "./contracts/environment";
import {
  LedgerCommandValidationError,
  LedgerPostingService,
} from "./services/ledger-posting-service";
import {
  QueueLedgerEventPublisher,
  type LedgerEventPublisher,
} from "./services/ledger-event-publisher";
import {
  D1LedgerPostingStore,
  type LedgerPostingStore,
} from "./stores/d1-ledger-posting-store";

interface WorkerStatus {
  ok: boolean;
  status: "healthy" | "ready";
  worker: "ledger";
  environment: LedgerEnv["ENVIRONMENT"];
  app: string;
  timestamp: string;
  version: string;
  git_sha: string;
}

interface LedgerRuntimeDependencies {
  store: LedgerPostingStore;
  event_publisher: LedgerEventPublisher;
  now: () => number;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function statusPayload(env: LedgerEnv, status: WorkerStatus["status"]): WorkerStatus {
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

function versionPayload(env: LedgerEnv) {
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

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function createRuntimeDependencies(env: LedgerEnv): LedgerRuntimeDependencies {
  return {
    store: new D1LedgerPostingStore(env.DB),
    event_publisher: new QueueLedgerEventPublisher(env.Q_LEDGER_EVENTS),
    now: nowUnixSeconds,
  };
}

export function createLedgerWorker(options?: {
  dependencies_factory?: (env: LedgerEnv) => LedgerRuntimeDependencies;
}) {
  return {
    async fetch(request: Request, env: LedgerEnv): Promise<Response> {
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
            message: "Route not found.",
          },
        },
        404,
      );
    },

    async queue(batch: MessageBatch<unknown>, env: LedgerEnv): Promise<void> {
      const dependencies =
        options?.dependencies_factory?.(env) ?? createRuntimeDependencies(env);
      const postingService = new LedgerPostingService(
        dependencies.store,
        dependencies.event_publisher,
        dependencies.now,
      );

      for (const message of batch.messages) {
        try {
          await postingService.process(message.body);
          message.ack();
        } catch (error) {
          if (error instanceof LedgerCommandValidationError) {
            const body = message.body as Record<string, unknown> | null;
            const tenant = body && typeof body.tenant_id === "string" ? body.tenant_id : null;
            const mode = body && (body.mode === "sandbox" || body.mode === "live")
              ? body.mode
              : null;
            const journal = body && typeof body.journal_id === "string" ? body.journal_id : null;
            const command = body && typeof body.command_id === "string" ? body.command_id : null;

            await dependencies.event_publisher.publishJournalRejected({
              tenant_id: tenant,
              mode,
              journal_id: journal,
              command_id: command,
              code: error.code,
              message: error.message,
            });
            message.ack();
            continue;
          }

          message.retry();
        }
      }
    },
  };
}

export default createLedgerWorker();
