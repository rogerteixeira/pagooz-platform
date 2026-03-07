import type { RequestContext } from "../../contracts/context";
import {
  createPaymentIntentSchema,
  paginationSchema,
} from "../../contracts/validation";
import { invalidRequest, notFound } from "../../http/errors";
import { parseJsonBody, parseQuery } from "../../http/request";
import { success } from "../../http/response";
import {
  serializePaymentIntent,
  serializePaymentIntentList,
} from "../../serializers/payment-intent-serializer";

function mustTenant(context: RequestContext): string {
  if (!context.tenant_id) {
    throw invalidRequest("missing_tenant", "Tenant could not be resolved.");
  }
  return context.tenant_id;
}

function mustMode(context: RequestContext): "sandbox" | "live" {
  if (!context.mode) {
    throw invalidRequest("missing_mode", "Mode could not be resolved.");
  }
  return context.mode;
}

export async function createPaymentIntentHandler(context: RequestContext): Promise<Response> {
  const payload = await parseJsonBody(context.request, createPaymentIntentSchema);
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  const created = await context.services.payment_intents.create(tenantId, mode, payload);

  return success(serializePaymentIntent(created), 201, context);
}

export async function getPaymentIntentByIdHandler(
  context: RequestContext,
  params: Record<string, string>,
): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  const id = params.id;
  if (!id) {
    throw invalidRequest("missing_resource_id", "PaymentIntent id is required.");
  }

  const record = await context.services.payment_intents.getById(tenantId, mode, id);

  if (!record) {
    throw notFound("payment_intent_not_found", "PaymentIntent not found.");
  }

  return success(serializePaymentIntent(record), 200, context);
}

export async function listPaymentIntentsHandler(context: RequestContext): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  const query = parseQuery(new URL(context.request.url), paginationSchema);
  const limit = query.limit ?? 20;

  const records = await context.services.payment_intents.list(tenantId, mode, {
    limit,
    status: query.status,
  });

  return success(
    {
      data: serializePaymentIntentList(records),
      has_more: records.length === limit,
    },
    200,
    context,
  );
}
