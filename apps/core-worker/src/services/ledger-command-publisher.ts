import type { LedgerPostEntriesCommand } from "../../../../packages/shared/src/contracts/ledger-command";

export interface LedgerCommandPublisher {
  publishPostEntries(command: LedgerPostEntriesCommand): Promise<void>;
}

export class QueueLedgerCommandPublisher implements LedgerCommandPublisher {
  constructor(private readonly queue: Queue) {}

  async publishPostEntries(command: LedgerPostEntriesCommand): Promise<void> {
    await this.queue.send(command);
  }
}

export class NoopLedgerCommandPublisher implements LedgerCommandPublisher {
  async publishPostEntries(_command: LedgerPostEntriesCommand): Promise<void> {
    return;
  }
}

export class CapturingLedgerCommandPublisher implements LedgerCommandPublisher {
  readonly commands: LedgerPostEntriesCommand[] = [];

  async publishPostEntries(command: LedgerPostEntriesCommand): Promise<void> {
    this.commands.push(command);
  }
}
