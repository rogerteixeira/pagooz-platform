export type InfrastructureEnvironment = "local" | "dev" | "staging" | "prod";

export interface LedgerEnv {
  DB: D1Database;
  Q_LEDGER_EVENTS: Queue;
  ENVIRONMENT: InfrastructureEnvironment;
  APP_NAME: string;
  APP_VERSION?: string;
  GIT_SHA?: string;
}
