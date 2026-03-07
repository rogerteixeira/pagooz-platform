import type { RequestContext } from "../../contracts/context";
import { createQuoteSchema } from "../../contracts/validation";
import { invalidRequest, notFound } from "../../http/errors";
import { parseJsonBody } from "../../http/request";
import { success } from "../../http/response";
import { serializeQuote } from "../../serializers/quote-serializer";

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

export async function createQuoteHandler(context: RequestContext): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);
  const payload = await parseJsonBody(context.request, createQuoteSchema);

  const created = await context.services.quotes.create(tenantId, mode, payload);
  return success(serializeQuote(created), 201, context);
}

export async function getQuoteByIdHandler(
  context: RequestContext,
  params: Record<string, string>,
): Promise<Response> {
  const tenantId = mustTenant(context);
  const mode = mustMode(context);

  if (!params.id) {
    throw invalidRequest("missing_resource_id", "Quote id is required.");
  }

  const quote = await context.services.quotes.getById(tenantId, mode, params.id);

  if (!quote) {
    throw notFound("quote_not_found", "Quote not found.");
  }

  return success(serializeQuote(quote), 200, context);
}
