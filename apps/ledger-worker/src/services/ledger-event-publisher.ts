import type { EventEnvelope } from "../../../../packages/shared/src/contracts/event-envelope";
import type { Mode } from "../../../../packages/shared/src/contracts/event-envelope";

export interface JournalPostedEventInput {
  tenant_id: string;
  mode: Mode;
  journal_id: string;
  reference_type: string;
  reference_id: string;
  currency: string;
  entry_count: number;
  total_debit: number;
  total_credit: number;
  posted_at: number;
}

export interface JournalRejectedEventInput {
  tenant_id: string | null;
  mode: Mode | null;
  journal_id: string | null;
  command_id: string | null;
  code: string;
  message: string;
}

export interface LedgerEventPublisher {
  publishJournalPosted(input: JournalPostedEventInput): Promise<void>;
  publishJournalRejected(input: JournalRejectedEventInput): Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function eventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "")}`;
}

function journalPostedData(input: JournalPostedEventInput): Record<string, unknown> {
  return {
    journal_id: input.journal_id,
    reference_type: input.reference_type,
    reference_id: input.reference_id,
    currency: input.currency,
    entry_count: input.entry_count,
    total_debit: input.total_debit,
    total_credit: input.total_credit,
    posted_at: input.posted_at,
  };
}

function journalRejectedData(input: JournalRejectedEventInput): Record<string, unknown> {
  return {
    command_id: input.command_id,
    journal_id: input.journal_id,
    error_code: input.code,
    error_message: input.message,
  };
}

export class QueueLedgerEventPublisher implements LedgerEventPublisher {
  constructor(private readonly queue: Queue) {}

  async publishJournalPosted(input: JournalPostedEventInput): Promise<void> {
    const event: EventEnvelope = {
      event_id: eventId(),
      event_type: "ledger.journal_posted",
      occurred_at: nowIso(),
      tenant_id: input.tenant_id,
      mode: input.mode,
      resources: {
        resource_type: "ledger_journal",
        resource_id: input.journal_id,
      },
      data: journalPostedData(input),
      visibility: {
        superadmin: true,
        business: true,
        consumer: false,
      },
    };

    await this.queue.send(event);
  }

  async publishJournalRejected(input: JournalRejectedEventInput): Promise<void> {
    if (!input.tenant_id || !input.mode) {
      return;
    }

    const event: EventEnvelope = {
      event_id: eventId(),
      event_type: "ledger.journal_rejected",
      occurred_at: nowIso(),
      tenant_id: input.tenant_id,
      mode: input.mode,
      resources: {
        resource_type: "ledger_journal",
        resource_id: input.journal_id ?? "unknown",
      },
      data: journalRejectedData(input),
      visibility: {
        superadmin: true,
        business: true,
        consumer: false,
      },
    };

    await this.queue.send(event);
  }
}

export class CapturingLedgerEventPublisher implements LedgerEventPublisher {
  readonly events: EventEnvelope[] = [];

  async publishJournalPosted(input: JournalPostedEventInput): Promise<void> {
    this.events.push({
      event_id: eventId(),
      event_type: "ledger.journal_posted",
      occurred_at: nowIso(),
      tenant_id: input.tenant_id,
      mode: input.mode,
      resources: {
        resource_type: "ledger_journal",
        resource_id: input.journal_id,
      },
      data: journalPostedData(input),
      visibility: {
        superadmin: true,
        business: true,
        consumer: false,
      },
    });
  }

  async publishJournalRejected(input: JournalRejectedEventInput): Promise<void> {
    if (!input.tenant_id || !input.mode) {
      return;
    }

    this.events.push({
      event_id: eventId(),
      event_type: "ledger.journal_rejected",
      occurred_at: nowIso(),
      tenant_id: input.tenant_id,
      mode: input.mode,
      resources: {
        resource_type: "ledger_journal",
        resource_id: input.journal_id ?? "unknown",
      },
      data: journalRejectedData(input),
      visibility: {
        superadmin: true,
        business: true,
        consumer: false,
      },
    });
  }
}
