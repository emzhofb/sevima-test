# [Epic-06] POST /workflows/:id/rollback endpoint

**Labels**: `epic-06`, `area-api`
**Estimate**: 1 jam
**Depends on**: #21 (rollback repo), #50

## Context

Rollback = bikin versi baru dari `targetVersion`. Hanya ADMIN.

## Acceptance Criteria

- [ ] `POST /workflows/:id/rollback` body `{ targetVersion: number }`
- [ ] Role ADMIN only
- [ ] Return 400 jika `targetVersion` tidak ada
- [ ] Return 404 jika workflow bukan milik tenant
- [ ] Audit log `workflow.rollback`

## Implementation Hints

```ts
fastify.post(
  '/workflows/:id/rollback',
  { preHandler: requireRole('ADMIN') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };
    const parsed = z.object({ targetVersion: z.number().int().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    try {
      const wf = await rollbackWorkflow(fastify.db, ctx.tenant_id, id, parsed.data.targetVersion, ctx.user_id);

      await writeAuditLog(fastify.db, {
        tenant_id: ctx.tenant_id,
        user_id: ctx.user_id,
        action: 'workflow.rollback',
        resource_type: 'workflow',
        resource_id: wf.id,
        request_id: ctx.request_id,
        metadata: { rolled_back_to: parsed.data.targetVersion, new_version: wf.current_version },
      });

      return wf;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('not found')) return reply.code(404).send({ error: 'not_found' });
      if (msg.includes('Version')) return reply.code(400).send({ error: 'invalid_target_version' });
      throw err;
    }
  },
);
```

## Files Involved

- Update `packages/api/src/routes/workflows.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/api test workflows.rollback
```
