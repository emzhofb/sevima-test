# [Epic-11] Webhook secret management

**Labels**: `epic-11`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #20 (workflow repo)

## Context

Setiap workflow optional punya webhook secret. Secret stored hashed di DB.

## Acceptance Criteria

- [ ] Migration: tambah kolom `webhook_secret_hash` ke `workflows` table
- [ ] `POST /workflows/:id/webhook/rotate-secret` returns plaintext secret (one-time view)
- [ ] Function `verifyWebhookSignature(body, timestamp, signature, secret_hash)`
- [ ] Hashing: bcrypt atau argon2

## Implementation Hints

Migration tambah kolom (atau tabel terpisah `workflow_webhooks`):

```js
exports.up = (pgm) => {
  pgm.addColumns('workflows', {
    webhook_secret_hash: { type: 'text' },
  });
};
```

Generate secret dengan crypto random:

```ts
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { hashPassword, verifyPassword } from '@flowforge/auth';

export async function rotateWebhookSecret(
  db: Db, tenantId: string, workflowId: string,
): Promise<string> {
  const plain = randomBytes(32).toString('hex');
  const hash = await hashPassword(plain);
  await db.query(
    'UPDATE workflows SET webhook_secret_hash = $1 WHERE tenant_id = $2 AND id = $3',
    [hash, tenantId, workflowId],
  );
  return plain;
}

export function computeWebhookSignature(secret: string, body: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}
```

## Files Involved

- `migrations/008_webhook_secret.js`
- `packages/api/src/repos/webhook.repo.ts`
- `packages/api/src/routes/webhooks.ts` (rotate endpoint)

## How to Verify

```bash
pnpm migrate:up
pnpm test
```
