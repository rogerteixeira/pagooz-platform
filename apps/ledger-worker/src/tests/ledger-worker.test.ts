import { describe, expect, it } from "vitest";
import { createLedgerWorker } from "../index";
import {
  LedgerCommandValidationError,
  LedgerPostingService,
} from "../services/ledger-posting-service";
import { CapturingLedgerEventPublisher } from "../services/ledger-event-publisher";
import { InMemoryLedgerPostingStore } from "./in-memory";
import type { LedgerPostEntriesCommand } from "../../../../packages/shared/src/contracts/ledger-command";

function validCommand(overrides?: Partial<LedgerPostEntriesCommand>): LedgerPostEntriesCommand {
  return {
    command_type: "ledger.post_entries",
    command_id: "cmd_1",
    tenant_id: "tnt_test",
    mode: "sandbox",
    legal_entity_id: "le_1",
    journal_id: "jrnl_1",
    reference_type: "quote",
    reference_id: "qt_1",
    currency: "USD",
    entries: [
      {
        account_type: "clearing_local",
        debit: 1200,
        credit: 0,
        metadata: { reason: "gross" },
      },
      {
        account_type: "merchant_balance",
        debit: 0,
        credit: 1000,
        metadata: { reason: "merchant" },
      },
      {
        account_type: "pagooz_revenue",
        debit: 0,
        credit: 150,
        metadata: { reason: "fees" },
      },
      {
        account_type: "tax_payable",
        debit: 0,
        credit: 50,
        metadata: { reason: "tax" },
      },
    ],
    ...overrides,
  };
}

function testEnv() {
  return {
    DB: {} as D1Database,
    Q_LEDGER_EVENTS: {
      send: async () => undefined,
      sendBatch: async () => undefined,
    } as unknown as Queue,
    ENVIRONMENT: "local" as const,
    APP_NAME: "pagooz-ledger",
    APP_VERSION: "0.1.0-test",
    GIT_SHA: "test-sha",
  };
}

describe("ledger worker foundation", () => {
  it("posts a valid journal and emits ledger.journal_posted", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const service = new LedgerPostingService(store, events, () => 1_760_000_001);

    const result = await service.process(validCommand());
    expect(result.status).toBe("posted");
    expect(store.journals.size).toBe(1);
    expect(store.entries).toHaveLength(4);
    expect(events.events.some((event) => event.event_type === "ledger.journal_posted")).toBe(
      true,
    );
  });

  it("rejects unbalanced journal", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const service = new LedgerPostingService(store, events, () => 1_760_000_001);

    await expect(
      service.process(
        validCommand({
          journal_id: "jrnl_unbalanced",
          entries: [
            {
              account_type: "clearing_local",
              debit: 1200,
              credit: 0,
              metadata: { reason: "gross" },
            },
            {
              account_type: "merchant_balance",
              debit: 0,
              credit: 1000,
              metadata: { reason: "merchant" },
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(LedgerCommandValidationError);

    expect(store.journals.size).toBe(0);
    expect(store.entries).toHaveLength(0);
  });

  it("rejects unsupported account_type", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const service = new LedgerPostingService(store, events, () => 1_760_000_001);

    await expect(
      service.process(
        validCommand({
          journal_id: "jrnl_bad_account",
          entries: [
            {
              account_type: "clearing_local",
              debit: 100,
              credit: 0,
              metadata: {},
            },
            {
              account_type: "not_supported" as any,
              debit: 0,
              credit: 100,
              metadata: {},
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(LedgerCommandValidationError);
  });

  it("is idempotent by journal_id", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const service = new LedgerPostingService(store, events, () => 1_760_000_001);

    const first = await service.process(validCommand({ journal_id: "jrnl_dup" }));
    const second = await service.process(
      validCommand({ command_id: "cmd_2", journal_id: "jrnl_dup" }),
    );

    expect(first.status).toBe("posted");
    expect(second.status).toBe("duplicate");
    expect(store.journals.size).toBe(1);
    expect(store.entries).toHaveLength(4);
    expect(events.events.filter((event) => event.event_type === "ledger.journal_posted")).toHaveLength(
      1,
    );
  });

  it("updates account balances deterministically", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const service = new LedgerPostingService(store, events, () => 1_760_000_001);

    await service.process(validCommand({ journal_id: "jrnl_bal_1" }));

    const balancesByType = new Map<string, number>();
    for (const account of store.accounts.values()) {
      balancesByType.set(account.account_type, store.balances.get(account.id) ?? 0);
    }

    expect(balancesByType.get("clearing_local")).toBe(1200);
    expect(balancesByType.get("merchant_balance")).toBe(-1000);
    expect(balancesByType.get("pagooz_revenue")).toBe(-150);
    expect(balancesByType.get("tax_payable")).toBe(-50);
  });

  it("queue consumer acks invalid commands and emits rejection event", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const worker = createLedgerWorker({
      dependencies_factory: () => ({
        store,
        event_publisher: events,
        now: () => 1_760_000_001,
      }),
    });

    let acked = 0;
    let retried = 0;

    const message = {
      body: {
        command_type: "ledger.post_entries",
        command_id: "cmd_bad",
        tenant_id: "tnt_test",
        mode: "sandbox",
        journal_id: "jrnl_bad",
        reference_type: "quote",
        reference_id: "qt_bad",
        currency: "USD",
        entries: [],
      },
      ack: () => {
        acked += 1;
      },
      retry: () => {
        retried += 1;
      },
    };

    await worker.queue(
      {
        messages: [message],
      } as unknown as MessageBatch<unknown>,
      testEnv(),
    );

    expect(acked).toBe(1);
    expect(retried).toBe(0);
    expect(events.events.some((event) => event.event_type === "ledger.journal_rejected")).toBe(
      true,
    );
  });

  it("queue consumer posts valid command and emits ledger.journal_posted", async () => {
    const store = new InMemoryLedgerPostingStore();
    const events = new CapturingLedgerEventPublisher();
    const worker = createLedgerWorker({
      dependencies_factory: () => ({
        store,
        event_publisher: events,
        now: () => 1_760_000_001,
      }),
    });

    let acked = 0;
    let retried = 0;
    const message = {
      body: validCommand({
        command_id: "cmd_queue_ok",
        journal_id: "jrnl_queue_ok",
      }),
      ack: () => {
        acked += 1;
      },
      retry: () => {
        retried += 1;
      },
    };

    await worker.queue(
      {
        messages: [message],
      } as unknown as MessageBatch<unknown>,
      testEnv(),
    );

    expect(acked).toBe(1);
    expect(retried).toBe(0);
    expect(store.journals.size).toBe(1);
    expect(events.events.some((event) => event.event_type === "ledger.journal_posted")).toBe(
      true,
    );
  });
});
