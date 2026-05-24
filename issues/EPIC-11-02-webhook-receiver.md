# [Epic-11] POST /webhooks/:tenant_slug/:workflow_id receiver

**Labels**: `epic-11`, `area-api`
**Estimate**: 2 jam
**Depends on**: #87

## Context

Public endpoint (tanpa JWT) yang verify HMAC signature + timestamp window 5 menit.

## Acceptance Criteria

- [ ] Endpoint tidak butuh JWT auth
- [ ] Verify header `X-Flowforge-Signature` dan `X-Flowforge-Timestamp`
- [ ] Tolak timestamp > 5 menit dari waktu server
- [ ] Tolak signature invalid → 401 generic (jangan beri info detail)
- [ ] Sukses: trigger run, return 202
- [ ] Test dengan signature valid + invalid + timestamp expired

## Implementation Hints

```ts
import { createHmac, timingSafeEqual } from 'crypto';
import { verifyPassword } from '@flowforge/auth';

fastify.post('/webhooks/:tenant_slug/:workflow_id', async (request, reply) => {
  const { tenant_slug, workflow_id } = request.params as { tenant_slug: string; workflow_id: string };
  const sig = request.headers['x-flowforge-signature'] as string;
  const tsRaw = request.headers['x-flowforge-timestamp'] as string;

  if (!sig || !tsRaw) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  const ts = Number(tsRaw);
  if (!Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  // Find tenant + workflow
  const wfRes = await fastify.db.query(
    `SELECT w.id, w.tenant_id, w.webhook_secret_hash, w.current_version, v.id as version_id
     FROM workflows w
     JOIN tenants t ON t.id = w.tenant_id
     JOIN workflow_versions v ON v.workflow_id = w.id AND v.version = w.current_version
     WHERE t.slug = $1 AND w.id = $2`,
    [tenant_slug, workflow_id],
  );
  const wf = wfRes.rows[0];
  if (!wf || !wf.webhook_secret_hash) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  // Compare HMAC: client computed hmac with their secret, we verify
  // For Argon2 hash compare: derive HMAC needs the plaintext secret.
  // Strategy: store plaintext encrypted with KMS or use HMAC hash directly (not Argon2).
  // For fresh grad: store plaintext in DB encrypted with JWT_SECRET as derivation.
  // Or: change webhook_secret_hash -> webhook_secret encrypted column.

  // Simplification: store webhook_secret as plaintext in DB column webhook_secret
  // (acceptable for MVP, document as known limitation).

  const body = JSON.stringify(request.body);
  const expectedSig = createHmac('sha256', wf.webhook_secret).update(`${ts}.${body}`).digest('hex');

  const sigBuffer = Buffer.from(sig, 'hex');
  const expectedBuffer = Buffer.from(expectedSig, 'hex');
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  // Trigger run
  const runRes = await fastify.db.query(
    `INSERT INTO runs (tenant_id, workflow_id, version_id, trigger_type, input, status)
     VALUES ($1, $2, $3, 'WEBHOOK', $4, 'PENDING') RETURNING id`,
    [wf.tenant_id, wf.id, wf.version_id, request.body ?? {}],
  );
  await fastify.broker.enqueue('flowforge:runs', {
    run_id: runRes.rows[0].id,
    tenant_id: wf.tenant_id,
  });

  return reply.code(202).send({ run_id: runRes.rows[0].id });
});
```

> **Note untuk fresh grad**: Karena Argon2 tidak reversible (good), kita tidak bisa pakai untuk HMAC verification. Simpler: simpan webhook secret as plaintext di kolom `webhook_secret` (encrypt at rest dgn DB encryption). Atau pakai fixed HMAC key yang dimanaged secrets manager. Untuk MVP, plaintext dengan dokumentasi cukup.

## Files Involved

- `packages/api/src/routes/webhooks.ts`
- Test file dengan valid/invalid signature

## How to Verify

```bash
pnpm -F @flowforge/api test webhooks
```
