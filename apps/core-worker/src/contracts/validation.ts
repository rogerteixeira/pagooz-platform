import { z } from "zod";

export const modeSchema = z.enum(["sandbox", "live"]);

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
});

export const createPaymentIntentSchema = z.object({
  legal_entity_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
  payer_country: z.string().trim().min(2).max(2).optional(),
  settlement_term: z.string().trim().min(2).max(10).optional(),
  fee_strategy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createQuoteSchema = z.object({
  payment_intent_id: z.string().min(1),
  payment_method: z.string().trim().min(2).max(40),
  installments: z.number().int().min(1).max(24).optional(),
});

export const createCheckoutSessionSchema = z.object({
  payment_intent_id: z.string().min(1),
  quote_id: z.string().min(1).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
  expires_in_seconds: z.number().int().min(60).max(86400).optional(),
});
