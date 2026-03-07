import { describe, expect, it } from "vitest";
import { createCoreWorker } from "../app";
import {
  QueueDomainEventSink,
  SinkBackedDomainEventPublisher,
} from "../services/domain-event-publisher";
import { CapturingLedgerCommandPublisher } from "../services/ledger-command-publisher";
import {
  CapturingDomainEventPublisher,
  createTestDependencies,
  createTestEnv,
} from "./in-memory";

function authHeaders(overrides?: Record<string, string>): Headers {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tnt_test",
    "x-mode": "sandbox",
    "x-api-key": "pk_test_123",
    "x-scopes":
      "payment_intents:write,payment_intents:read,quotes:write,quotes:read,checkout_sessions:write,checkout_sessions:read",
    "idempotency-key": crypto.randomUUID(),
  });

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      headers.set(key, value);
    }
  }

  return headers;
}

async function json(response: Response): Promise<any> {
  return response.json();
}

async function createPaymentIntent(
  worker: ReturnType<typeof createCoreWorker>,
  payloadOverrides?: Record<string, unknown>,
): Promise<any> {
  const response = await worker.fetch(
    new Request("http://localhost/v1/payment_intents", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        legal_entity_id: "le_1",
        amount: 10_000,
        currency: "USD",
        ...payloadOverrides,
      }),
    }),
    createTestEnv(),
  );

  return json(response);
}

async function createQuote(
  worker: ReturnType<typeof createCoreWorker>,
  paymentIntentId: string,
  payloadOverrides?: Record<string, unknown>,
): Promise<any> {
  const response = await worker.fetch(
    new Request("http://localhost/v1/quotes", {
      method: "POST",
      headers: authHeaders({
        "idempotency-key": crypto.randomUUID(),
      }),
      body: JSON.stringify({
        payment_intent_id: paymentIntentId,
        payment_method: "card",
        ...payloadOverrides,
      }),
    }),
    createTestEnv(),
  );

  return json(response);
}

describe("core worker foundation", () => {
  it("returns route_not_found for unknown route", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/unknown", { method: "GET" }),
      createTestEnv(),
    );

    expect(response.status).toBe(404);
    expect((await json(response)).error.code).toBe("route_not_found");
  });

  it("enforces tenant and mode", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          "x-api-key": "pk_test_123",
          "idempotency-key": "idem_1",
        }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 1000,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("missing_tenant");
  });

  it("rejects invalid mode value", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({ "x-mode": "invalid" }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 1000,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("missing_mode");
  });

  it("validates request payload", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: -5,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("invalid_request");
  });

  it("creates and retrieves payment_intents", async () => {
    const publisher = new CapturingDomainEventPublisher();
    const dependencies = createTestDependencies(publisher);
    const worker = createCoreWorker({
      dependencies_factory: () => dependencies,
    });

    const createResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 12000,
          currency: "usd",
          metadata: { source: "test" },
        }),
      }),
      createTestEnv(),
    );

    expect(createResponse.status).toBe(201);
    const created = await json(createResponse);
    expect(created.id).toMatch(/^pi_/);
    expect(created.mode).toBe("sandbox");
    expect(created.currency).toBe("USD");

    const listResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "GET",
        headers: authHeaders(),
      }),
      createTestEnv(),
    );

    expect(listResponse.status).toBe(200);
    const listed = await json(listResponse);
    expect(listed.data).toHaveLength(1);

    const getResponse = await worker.fetch(
      new Request(`http://localhost/v1/payment_intents/${created.id}`, {
        method: "GET",
        headers: authHeaders(),
      }),
      createTestEnv(),
    );

    expect(getResponse.status).toBe(200);
    expect((await json(getResponse)).id).toBe(created.id);
    expect(
      publisher.events.some((event) => event.event_type === "payment_intent.created"),
    ).toBe(true);
  });

  it("creates quotes from payment_intents", async () => {
    const dependencies = createTestDependencies();
    const worker = createCoreWorker({
      dependencies_factory: () => dependencies,
    });

    const paymentIntentResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 10000,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    const paymentIntent = await json(paymentIntentResponse);

    const quoteResponse = await worker.fetch(
      new Request("http://localhost/v1/quotes", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_quote_1" }),
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          payment_method: "card",
        }),
      }),
      createTestEnv(),
    );

    expect(quoteResponse.status).toBe(201);
    const quote = await json(quoteResponse);
    expect(quote.id).toMatch(/^qt_/);
    expect(quote.payment_intent_id).toBe(paymentIntent.id);
    expect(quote.payer_total).toBeGreaterThan(quote.receiver_net);

    const getQuoteResponse = await worker.fetch(
      new Request(`http://localhost/v1/quotes/${quote.id}`, {
        method: "GET",
        headers: authHeaders(),
      }),
      createTestEnv(),
    );

    expect(getQuoteResponse.status).toBe(200);
  });

  it("publishes ledger.post_entries command when quote is created", async () => {
    const ledgerPublisher = new CapturingLedgerCommandPublisher();
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(undefined, ledgerPublisher),
    });

    const paymentIntentResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          legal_entity_id: "le_2",
          amount: 5_000,
          currency: "USD",
          payer_country: "US",
        }),
      }),
      createTestEnv(),
    );

    const paymentIntent = await json(paymentIntentResponse);

    const quoteResponse = await worker.fetch(
      new Request("http://localhost/v1/quotes", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_quote_ledger_emit" }),
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          payment_method: "card",
          installments: 2,
        }),
      }),
      createTestEnv(),
    );

    expect(quoteResponse.status).toBe(201);
    const quote = await json(quoteResponse);

    expect(ledgerPublisher.commands).toHaveLength(1);
    const command = ledgerPublisher.commands[0];
    expect(command.command_type).toBe("ledger.post_entries");
    expect(command.reference_type).toBe("quote");
    expect(command.reference_id).toBe(quote.id);
    expect(command.legal_entity_id).toBe("le_2");
    expect(command.entries.length).toBeGreaterThanOrEqual(2);
    const totalDebit = command.entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = command.entries.reduce((sum, entry) => sum + entry.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("creates checkout_sessions linked to payment_intent and quote", async () => {
    const dependencies = createTestDependencies();
    const worker = createCoreWorker({
      dependencies_factory: () => dependencies,
    });

    const paymentIntentResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 2000,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    const paymentIntent = await json(paymentIntentResponse);

    const quoteResponse = await worker.fetch(
      new Request("http://localhost/v1/quotes", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_quote_2" }),
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          payment_method: "pix",
        }),
      }),
      createTestEnv(),
    );

    const quote = await json(quoteResponse);

    const checkoutResponse = await worker.fetch(
      new Request("http://localhost/v1/checkout_sessions", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_cs_1" }),
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          quote_id: quote.id,
          locale: "en-US",
        }),
      }),
      createTestEnv(),
    );

    expect(checkoutResponse.status).toBe(201);
    const checkout = await json(checkoutResponse);
    expect(checkout.id).toMatch(/^cs_/);
    expect(checkout.status).toBe("created");
    expect(checkout.locale).toBe("en-US");

    const getResponse = await worker.fetch(
      new Request(`http://localhost/v1/checkout_sessions/${checkout.id}`, {
        method: "GET",
        headers: authHeaders(),
      }),
      createTestEnv(),
    );

    expect(getResponse.status).toBe(200);
    expect((await json(getResponse)).id).toBe(checkout.id);
  });

  it("lists checkout_sessions", async () => {
    const dependencies = createTestDependencies();
    const worker = createCoreWorker({
      dependencies_factory: () => dependencies,
    });

    const paymentIntentResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_list_pi" }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 3500,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    const paymentIntent = await json(paymentIntentResponse);

    await worker.fetch(
      new Request("http://localhost/v1/checkout_sessions", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_list_cs_1" }),
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
        }),
      }),
      createTestEnv(),
    );

    const listResponse = await worker.fetch(
      new Request("http://localhost/v1/checkout_sessions", {
        method: "GET",
        headers: authHeaders(),
      }),
      createTestEnv(),
    );

    expect(listResponse.status).toBe(200);
    const listed = await json(listResponse);
    expect(Array.isArray(listed.data)).toBe(true);
    expect(listed.data).toHaveLength(1);
  });

  it("requires idempotency key for POST routes", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const headers = authHeaders();
    headers.delete("idempotency-key");

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers,
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 100,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("missing_idempotency_key");
  });

  it("returns authentication error when auth is missing", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "GET",
        headers: new Headers({
          "x-tenant-id": "tnt_test",
          "x-mode": "sandbox",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(401);
    expect((await json(response)).error.code).toBe("authentication_required");
  });

  it("returns legal_entity_not_found for invalid legal entity", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_missing_legal_entity" }),
        body: JSON.stringify({
          legal_entity_id: "le_missing",
          amount: 900,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(404);
    expect((await json(response)).error.code).toBe("legal_entity_not_found");
  });

  it("serializes resources without raw json columns", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntentResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_serializer_pi" }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 2500,
          currency: "USD",
          metadata: { source: "serializer-test" },
        }),
      }),
      createTestEnv(),
    );

    const paymentIntent = await json(paymentIntentResponse);
    expect(paymentIntent).toHaveProperty("metadata");
    expect(paymentIntent).not.toHaveProperty("metadata_json");
    expect(paymentIntent).not.toHaveProperty("fee_strategy_json");

    const quoteResponse = await worker.fetch(
      new Request("http://localhost/v1/quotes", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_serializer_quote" }),
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          payment_method: "card",
        }),
      }),
      createTestEnv(),
    );

    const quote = await json(quoteResponse);
    expect(quote).toHaveProperty("breakdown");
    expect(quote).not.toHaveProperty("breakdown_json");
    expect(quote).not.toHaveProperty("fx_json");
    expect(quote.breakdown).toHaveProperty("fee_breakdown");
    expect(quote.breakdown).toHaveProperty("tax_breakdown");
    expect(quote.breakdown).toHaveProperty("applied_rule_summary");
    expect(quote.breakdown).toHaveProperty("signature_input_base");
  });

  it("returns legal_entity_inactive when legal entity is suspended", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_inactive_legal_entity" }),
        body: JSON.stringify({
          legal_entity_id: "le_suspended",
          amount: 900,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("legal_entity_inactive");
  });

  it("enforces required scopes on write routes", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({
          "x-scopes": "payment_intents:read",
        }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 1_500,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(403);
    expect((await json(response)).error.code).toBe("insufficient_scope");
  });

  it("enforces required scopes on read routes", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const response = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "GET",
        headers: authHeaders({
          "x-scopes": "payment_intents:write",
        }),
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(403);
    expect((await json(response)).error.code).toBe("insufficient_scope");
  });

  it("allows platform_admin role to bypass scope checks", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const createResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({
          "x-scopes": "",
          "x-roles": "platform_admin",
          "idempotency-key": "idem_platform_admin_create_pi",
        }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 1_700,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(createResponse.status).toBe(201);
  });

  it("does not allow generic admin role as operational bypass", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const createResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({
          "x-scopes": "",
          "x-roles": "admin",
          "idempotency-key": "idem_generic_admin_create_pi",
        }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 1_700,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(createResponse.status).toBe(403);
    expect((await json(createResponse)).error.code).toBe("insufficient_scope");
  });

  it("applies payer-absorbed fee strategy to quote totals", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker, {
      fee_strategy: { absorption: "payer" },
    });
    const quote = await createQuote(worker, paymentIntent.id);

    expect(quote.payer_total).toBeGreaterThan(quote.receiver_net);
    expect(quote.receiver_net).toBe(paymentIntent.amount);
    expect(quote.breakdown.fee_breakdown.service_fee.amount).toBeGreaterThan(0);
    expect(quote.breakdown.tax_breakdown.items[0].code).toBe("generic_tax");
  });

  it("applies merchant-absorbed fee strategy to quote totals", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker, {
      fee_strategy: { absorption: "merchant" },
    });
    const quote = await createQuote(worker, paymentIntent.id);

    expect(quote.payer_total).toBe(paymentIntent.amount);
    expect(quote.receiver_net).toBeLessThan(paymentIntent.amount);
    expect(quote.breakdown.applied_rule_summary.fee_strategy).toBe("merchant");
  });

  it("increases MDR when installments increase", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker);
    const quote1 = await createQuote(worker, paymentIntent.id, { installments: 1 });
    const quote6 = await createQuote(worker, paymentIntent.id, { installments: 6 });

    expect(quote6.breakdown.fee_breakdown.mdr.amount).toBeGreaterThan(
      quote1.breakdown.fee_breakdown.mdr.amount,
    );
  });

  it("changes settlement fee by settlement term", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const d0Intent = await createPaymentIntent(worker, { settlement_term: "D+0" });
    const d2Intent = await createPaymentIntent(worker, { settlement_term: "D+2" });
    const d0Quote = await createQuote(worker, d0Intent.id);
    const d2Quote = await createQuote(worker, d2Intent.id);

    expect(d0Quote.breakdown.fee_breakdown.settlement_fee.amount).toBeGreaterThan(
      d2Quote.breakdown.fee_breakdown.settlement_fee.amount,
    );
  });

  it("applies min and max fee boundaries", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const lowIntent = await createPaymentIntent(worker, { amount: 100 });
    const highIntent = await createPaymentIntent(worker, { amount: 1_000_000 });
    const lowQuote = await createQuote(worker, lowIntent.id);
    const highQuote = await createQuote(worker, highIntent.id);

    expect(lowQuote.breakdown.fee_breakdown.service_fee.applied_minimum).toBe(true);
    expect(highQuote.breakdown.fee_breakdown.service_fee.applied_maximum).toBe(true);
  });

  it("falls back to default rules when method/term are unknown", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker, { settlement_term: "FAST" });
    const quote = await createQuote(worker, paymentIntent.id, {
      payment_method: "unknown_method",
    });

    expect(quote.breakdown.applied_rule_summary.payment_method_rule).toBe("default");
    expect(quote.breakdown.applied_rule_summary.fallbacks).toContain("mdr_rule_default");
    expect(quote.breakdown.applied_rule_summary.fallbacks).toContain(
      "settlement_rule_default",
    );
  });

  it("resolves receiver_country from legal entity profile, not fee_strategy payload", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker, {
      legal_entity_id: "le_2",
      payer_country: "US",
      fee_strategy: {
        absorption: "payer",
        receiver_country: "MX",
      },
    });

    const quote = await createQuote(worker, paymentIntent.id, {
      payment_method: "card",
    });

    // le_2 country is BR in the test repository seed.
    expect(quote.fx.corridor_code).toContain("US->BR");
  });

  it("returns explicit FX reference-rate placeholder semantics", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker);
    const quote = await createQuote(worker, paymentIntent.id);

    expect(quote.fx.reference_rate_ppm).toBe(1_000_000);
    expect(quote.fx).not.toHaveProperty("base_rate_ppm");
  });

  it("changes quote signature when economics change", async () => {
    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(),
    });

    const paymentIntent = await createPaymentIntent(worker);
    const quoteInstallment1 = await createQuote(worker, paymentIntent.id, { installments: 1 });
    const quoteInstallment3 = await createQuote(worker, paymentIntent.id, { installments: 3 });

    expect(quoteInstallment1.signature).not.toBe(quoteInstallment3.signature);
  });

  it("publishes domain events through a dedicated sink contract", async () => {
    const events: Array<Record<string, unknown>> = [];
    const queue = {
      send: async (message: unknown) => {
        events.push(message as Record<string, unknown>);
      },
      sendBatch: async () => undefined,
    } as unknown as Queue;

    const domainPublisher = new SinkBackedDomainEventPublisher(
      new QueueDomainEventSink(queue),
      () => "2026-03-07T00:00:00.000Z",
    );

    const worker = createCoreWorker({
      dependencies_factory: () => createTestDependencies(domainPublisher),
    });

    const createResponse = await worker.fetch(
      new Request("http://localhost/v1/payment_intents", {
        method: "POST",
        headers: authHeaders({ "idempotency-key": "idem_domain_sink" }),
        body: JSON.stringify({
          legal_entity_id: "le_1",
          amount: 2_100,
          currency: "USD",
        }),
      }),
      createTestEnv(),
    );

    expect(createResponse.status).toBe(201);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("payment_intent.created");
    expect(events[0]).not.toHaveProperty("command_type");
  });
});
