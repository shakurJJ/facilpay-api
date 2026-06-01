# Idempotency Key Support

## Overview

The payment creation endpoint supports idempotency keys to prevent duplicate payments when requests are retried.

## Usage

Include an `Idempotency-Key` header with a unique value when creating a payment:

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{"amount":100,"currency":"USD","description":"Order #12345"}'
```

## Behavior

- **First request**: Creates a new payment and caches the response
- **Duplicate request** (same key + same body): Returns the cached response without creating a new payment
- **Mismatched request** (same key + different body): Returns 422 Unprocessable Entity
- **Expired key**: Keys expire after 24 hours (configurable via `IDEMPOTENCY_TTL_HOURS`)

## Configuration

Set the TTL in your `.env` file:

```env
IDEMPOTENCY_TTL_HOURS=24
```

## Examples

### Successful Retry

```bash
# First request
curl -X POST http://localhost:3000/payments \
  -H "Idempotency-Key: key-123" \
  -d '{"amount":100,"currency":"USD"}'
# Response: 201 Created, payment ID: abc-123

# Retry with same key and body
curl -X POST http://localhost:3000/payments \
  -H "Idempotency-Key: key-123" \
  -d '{"amount":100,"currency":"USD"}'
# Response: 201 Created, same payment ID: abc-123
```

### Key Reuse Error

```bash
# First request
curl -X POST http://localhost:3000/payments \
  -H "Idempotency-Key: key-456" \
  -d '{"amount":100,"currency":"USD"}'
# Response: 201 Created

# Retry with same key but different body
curl -X POST http://localhost:3000/payments \
  -H "Idempotency-Key: key-456" \
  -d '{"amount":200,"currency":"EUR"}'
# Response: 422 Unprocessable Entity
# Message: "Idempotency key reused with different request body"
```

## Database

Idempotency keys are stored in the `idempotency_keys` table with automatic expiry cleanup.
