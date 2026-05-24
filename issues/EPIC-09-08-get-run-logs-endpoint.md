# [Epic-09] GET /runs/:id/logs endpoint

**Labels**: `epic-09`, `good-first-issue`, `area-api`
**Estimate**: 1 jam
**Depends on**: #80 (logs)

## Context

Endpoint untuk dashboard log viewer.

## Acceptance Criteria

- [ ] `GET /runs/:id/logs?step_id=&page=&pageSize=`
- [ ] Default pageSize 50, max 200
- [ ] Order by `ts ASC`
- [ ] Tenant scoped

## Implementation Hints

```ts
fastify.get('/runs/:id/logs', { preHandler: requireRole('VIEWER') }, async (request, reply) => {
  const ctx = request.ctx!;
  const { id } = request.params as { id: string };
  const querySchema = z.object({
    step_id: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  });
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });

  const conditions = ['tenant_id = $1', 'run_id = $2'];
  const params: unknown[] = [ctx.tenant_id, id];
  if (parsed.data.step_id) {
    params.push(parsed.data.step_id);
    conditions.push(`step_id = $${params.length}`);
  }

  params.push(parsed.data.pageSize, (parsed.data.page - 1) * parsed.data.pageSize);

  const rows = await fastify.db.query(
    `SELECT * FROM logs
     WHERE ${conditions.join(' AND ')}
     ORDER BY ts ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { items: rows.rows };
});
```

## Files Involved

- Update `packages/api/src/routes/runs.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test runs.logs
```
