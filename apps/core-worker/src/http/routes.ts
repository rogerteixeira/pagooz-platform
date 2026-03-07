import type { Route } from "./router";
import {
  createCheckoutSessionHandler,
  getCheckoutSessionByIdHandler,
  listCheckoutSessionsHandler,
} from "../modules/checkout-sessions/handlers";
import {
  createPaymentIntentHandler,
  getPaymentIntentByIdHandler,
  listPaymentIntentsHandler,
} from "../modules/payment-intents/handlers";
import { createQuoteHandler, getQuoteByIdHandler } from "../modules/quotes/handlers";
import { healthHandler, readyHandler, versionHandler } from "../modules/system/handlers";

const SYSTEM_META = {
  requires_tenant_mode: false,
  requires_auth: false,
  requires_idempotency: false,
  required_scopes: [],
  allow_operational_bypass: false,
} as const;

const AUTH_READ_META = {
  requires_tenant_mode: true,
  requires_auth: true,
  requires_idempotency: false,
  required_scopes: [] as const,
  allow_operational_bypass: true,
} as const;

const AUTH_WRITE_META = {
  requires_tenant_mode: true,
  requires_auth: true,
  requires_idempotency: true,
  required_scopes: [] as const,
  allow_operational_bypass: true,
} as const;

const SCOPE_PAYMENT_INTENTS_WRITE = ["payment_intents:write"] as const;
const SCOPE_PAYMENT_INTENTS_READ = ["payment_intents:read"] as const;
const SCOPE_QUOTES_WRITE = ["quotes:write"] as const;
const SCOPE_QUOTES_READ = ["quotes:read"] as const;
const SCOPE_CHECKOUT_WRITE = ["checkout_sessions:write"] as const;
const SCOPE_CHECKOUT_READ = ["checkout_sessions:read"] as const;

export function buildRoutes(): Route[] {
  return [
    {
      method: "GET",
      path: "/health",
      handler: async (context) => healthHandler(context),
      meta: SYSTEM_META,
    },
    {
      method: "GET",
      path: "/ready",
      handler: async (context) => readyHandler(context),
      meta: SYSTEM_META,
    },
    {
      method: "GET",
      path: "/version",
      handler: async (context) => versionHandler(context),
      meta: SYSTEM_META,
    },
    {
      method: "POST",
      path: "/v1/payment_intents",
      handler: async (context) => createPaymentIntentHandler(context),
      meta: {
        ...AUTH_WRITE_META,
        required_scopes: SCOPE_PAYMENT_INTENTS_WRITE,
      },
    },
    {
      method: "GET",
      path: "/v1/payment_intents",
      handler: async (context) => listPaymentIntentsHandler(context),
      meta: {
        ...AUTH_READ_META,
        required_scopes: SCOPE_PAYMENT_INTENTS_READ,
      },
    },
    {
      method: "GET",
      path: "/v1/payment_intents/:id",
      handler: async (context, params) => getPaymentIntentByIdHandler(context, params),
      meta: {
        ...AUTH_READ_META,
        required_scopes: SCOPE_PAYMENT_INTENTS_READ,
      },
    },
    {
      method: "POST",
      path: "/v1/quotes",
      handler: async (context) => createQuoteHandler(context),
      meta: {
        ...AUTH_WRITE_META,
        required_scopes: SCOPE_QUOTES_WRITE,
      },
    },
    {
      method: "GET",
      path: "/v1/quotes/:id",
      handler: async (context, params) => getQuoteByIdHandler(context, params),
      meta: {
        ...AUTH_READ_META,
        required_scopes: SCOPE_QUOTES_READ,
      },
    },
    {
      method: "POST",
      path: "/v1/checkout_sessions",
      handler: async (context) => createCheckoutSessionHandler(context),
      meta: {
        ...AUTH_WRITE_META,
        required_scopes: SCOPE_CHECKOUT_WRITE,
      },
    },
    {
      method: "GET",
      path: "/v1/checkout_sessions",
      handler: async (context) => listCheckoutSessionsHandler(context),
      meta: {
        ...AUTH_READ_META,
        required_scopes: SCOPE_CHECKOUT_READ,
      },
    },
    {
      method: "GET",
      path: "/v1/checkout_sessions/:id",
      handler: async (context, params) => getCheckoutSessionByIdHandler(context, params),
      meta: {
        ...AUTH_READ_META,
        required_scopes: SCOPE_CHECKOUT_READ,
      },
    },
  ];
}
