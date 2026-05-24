# [Epic-07] POST /runs/:id/cancel

**Labels**: `epic-07`, `area-api`
**Estimate**: 1 jam
**Depends on**: #58

## Context

Set run ke CANCELLED state. Worker akan check sebelum execute step (lihat Epic 09).

## Acceptance Criteria

- [ ] `POST /runs/:id/cancel`
- [ ] Role minimum EDITOR
- [ ] Validasi: run masih dalam state non-terminal
- [ ] Update status ke CANCELLED
- [ ] Audit log

## Implementation Hints

```ts
fastify.post(
  '/runs/:id/cancel',
  { preHandler: requireRole('EDITOR') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };

    const run = await getRunById(fastify.db, ctx.tenant_id, id);
    if (!run) return reply.code(404).send({ error: 'not_found' });

    try {
      await withTransaction(fastify.db, async (client) => {
        await transitionRunStatus(client, id, 'CANCELLED');
      });
    } catch (err) {
      if (err instanceof IllegalStateTransitionError) {
        return reply.code(409).send({ error: 'cannot_cancel', current_status: run.status });
      }
      throw err;
    }

    await writeAuditLog(fastify.db, {
      tenant_id: ctx.tenant_id,
      user_id: ctx.user_id,
      action: 'run.cancel',
      resource_type: 'run',
      resource_id: id,
      request_id: ctx.request_id,
    });

    return { status: 'CANCELLED' };
  },
);
```

Test:

```ts
it('cancels a running run', async () => {
  // Setup run in RUNNING state
  const res = await app.inject({ method: 'POST', url: `/runs/${runId}/cancel`, headers });
  expect(res.statusCode).toBe(200);
});

it('returns 409 for already-finished run', async () => {
  // Setup run in SUCCEEDED state
  const res = await app.inject({ method: 'POST', url: `/runs/${runId}/cancel`, headers });
  expect(res.statusCode).toBe(409);
});
```

## Files Involved

- Update `packages/api/src/routes/runs.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test runs.cancel
```
