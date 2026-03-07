# Webhook Delivery Model

## Purpose
Webhooks provide external delivery of platform events to third-party systems.

## Delivery Principles
- signed payload validation
- timestamp validation to reduce replay risk
- deterministic retry behavior
- idempotent consumer expectations
- observability for delivery status and failures

## Queue Separation
Webhook delivery commands are consumed from:
- `q-webhook-outbox-{env}`

This queue is delivery-specific and separate from domain event transport.

## Operational Expectations
- Delivery workers must retry transient failures.
- Permanent validation failures should be classified and surfaced for operations.
- Delivery metadata must preserve tenant/mode context for diagnostics.
