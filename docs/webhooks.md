# Pagooz Webhooks v1

## Endpoint Configuration

Each webhook endpoint includes:

- URL
- Mode (sandbox | live)
- Subscribed event types
- Signing secret
- Status (enabled | disabled)

## Delivery Format

POST JSON:

{
  "id": "evt_123",
  "type": "payment.succeeded",
  "created": 1760000000,
  "mode": "sandbox",
  "data": { "object": {} }
}

## Headers

Pagooz-Timestamp: unix_timestamp
Pagooz-Signature: hmac_sha256(secret, timestamp + "." + raw_body)

## Retry Policy

- Max attempts: 18
- Backoff: exponential + jitter
- Timeout: 8 seconds
- Failures go to DLQ
- Manual resend allowed

## Visibility

Webhook payloads NEVER include:
- Superadmin-only fields
- Internal FX route details
- Provider secrets