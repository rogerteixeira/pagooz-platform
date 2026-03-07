export type InfrastructureEnvironment = "local" | "dev" | "staging" | "prod";
export type Mode = "sandbox" | "live";

export interface CoreEnv {
  DB: D1Database;
  Q_LEDGER_COMMANDS: Queue;
  Q_DOMAIN_EVENTS: Queue;
  Q_NOTIFICATION_OUTBOX: Queue;
  Q_WEBHOOK_OUTBOX: Queue;
  ARTIFACTS_BUCKET: R2Bucket;
  ENVIRONMENT: InfrastructureEnvironment;
  APP_NAME: string;
  DEFAULT_LOCALE: string;
  APP_VERSION?: string;
  GIT_SHA?: string;
}
