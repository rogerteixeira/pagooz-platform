import type { Mode } from "../contracts/environment";
import type { EventEnvelope } from "../../../../packages/shared/src/contracts/event-envelope";

export interface ResourceCreatedEventInput {
  event_type: "payment_intent.created" | "quote.created" | "checkout_session.created";
  tenant_id: string;
  mode: Mode;
  resource_type: "payment_intent" | "quote" | "checkout_session";
  resource_id: string;
  data: Record<string, unknown>;
}

export interface DomainEventPublisher {
  publishResourceCreated(input: ResourceCreatedEventInput): Promise<void>;
}

function toEnvelope(
  input: ResourceCreatedEventInput,
  nowIso: () => string,
): EventEnvelope {
  return {
    event_id: `evt_${crypto.randomUUID().replace(/-/g, "")}`,
    event_type: input.event_type,
    occurred_at: nowIso(),
    tenant_id: input.tenant_id,
    mode: input.mode,
    resources: {
      resource_type: input.resource_type,
      resource_id: input.resource_id,
    },
    data: input.data,
    visibility: {
      superadmin: true,
      business: true,
      consumer: false,
    },
  };
}

export interface DomainEventSink {
  publish(event: EventEnvelope): Promise<void>;
}

export class QueueDomainEventSink implements DomainEventSink {
  constructor(private readonly queue: Queue) {}

  async publish(event: EventEnvelope): Promise<void> {
    await this.queue.send(event);
  }
}

export class NoopDomainEventSink implements DomainEventSink {
  async publish(_event: EventEnvelope): Promise<void> {
    return;
  }
}

export class CapturingDomainEventSink implements DomainEventSink {
  readonly events: EventEnvelope[] = [];

  async publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
  }
}

export class SinkBackedDomainEventPublisher implements DomainEventPublisher {
  constructor(
    private readonly sink: DomainEventSink,
    private readonly nowIso: () => string = () => new Date().toISOString(),
  ) {}

  async publishResourceCreated(input: ResourceCreatedEventInput): Promise<void> {
    await this.sink.publish(toEnvelope(input, this.nowIso));
  }
}

// Core domain events are intentionally decoupled from delivery command queues.
// Delivery commands live in dedicated notification/webhook queue contracts.
export class NoopDomainEventPublisher extends SinkBackedDomainEventPublisher {
  constructor() {
    super(new NoopDomainEventSink());
  }
}

export class CapturingDomainEventPublisher implements DomainEventPublisher {
  private readonly sink = new CapturingDomainEventSink();
  readonly events = this.sink.events;

  async publishResourceCreated(input: ResourceCreatedEventInput): Promise<void> {
    await this.sink.publish(toEnvelope(input, () => new Date().toISOString()));
  }
}
