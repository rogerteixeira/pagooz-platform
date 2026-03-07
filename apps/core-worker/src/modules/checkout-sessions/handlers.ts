import type { RequestContext } from "../../contracts/context";
import {
  createCheckoutSessionSchema,
  paginationSchema,
} from "../../contracts/validation";
import { invalidRequest, notFound } from "../../http/errors";
import { parseJsonBody, parseQuery } from "../../http/request";
import { success } from "../../http/response";
import {
  serializeCheckoutSession,
  serializeCheckoutSessionList,
} from "../../serializers/checkout-session-serializer";

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

export async function createCheckoutSessionHandler(context: RequestContext): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  const payload = await parseJsonBody(context.request, createCheckoutSessionSchema);

  const created = await context.services.checkout_sessions.create(tenantId, mode, payload);
  return success(serializeCheckoutSession(created), 201, context);
}

export async function getCheckoutSessionByIdHandler(
  context: RequestContext,
  params: Record<string, string>,
): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  if (!params.id) {
    throw invalidRequest("missing_resource_id", "CheckoutSession id is required.");
  }

  const session = await context.services.checkout_sessions.getById(tenantId, mode, params.id);

  if (!session) {
    throw notFound("checkout_session_not_found", "CheckoutSession not found.");
  }

  return success(serializeCheckoutSession(session), 200, context);
}

export async function listCheckoutSessionsHandler(context: RequestContext): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  const query = parseQuery(new URL(context.request.url), paginationSchema);
  const limit = query.limit ?? 20;

  const sessions = await context.services.checkout_sessions.list(tenantId, mode, {
    limit,
    status: query.status,
  });

  return success(
    {
      data: serializeCheckoutSessionList(sessions),
      has_more: sessions.length === limit,
    },
    200,
    context,
  );
}
