# [Epic-06] DELETE /workflows/:id endpoint

**Labels**: `epic-06`, `good-first-issue`, `area-api`
**Estimate**: 0.5 jam
**Depends on**: #50

## Context

Delete = hard delete (cascade ke versions, runs). Hanya ADMIN.

## Acceptance Criteria

- [ ] `DELETE /workflows/:id`
- [ ] Role ADMIN only
- [ ] Return 204 No Content jika sukses
- [ ] Return 404 jika tidak ada / cross-tenant
- [ ] Audit log `workflow.delete`

## Implementation Hints

Tambahkan ke repository:

```ts
export async function deleteWorkflow(
  db: Db,
  tenantId: string,
  id: string,
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM workflows WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
```

```ts
fastify.delete(
  '/workflows/:id',
  { preHandler: requireRole('ADMIN') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };

    const deleted = await deleteWorkflow(fastify.db, ctx.tenant_id, id);
    if (!deleted) return reply.code(404).send({ error: 'not_found' });

    await writeAuditLog(fastify.db, {
      tenant_id: ctx.tenant_id,
      user_id: ctx.user_id,
      action: 'workflow.delete',
      resource_type: 'workflow',
      resource_id: id,
      request_id: ctx.request_id,
    });

    return reply.code(204).send();
  },
);
```

## Files Involved

- Update `packages/api/src/repos/workflow.repo.ts`
- Update `packages/api/src/routes/workflows.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/api test workflows.delete
```
