# [Epic-07] GET /runs/:id/steps endpoint

**Labels**: `epic-07`, `good-first-issue`, `area-api`
**Estimate**: 1 jam
**Depends on**: #58

## Context

List step runs untuk satu run. Dipakai dashboard untuk render timeline.

## Acceptance Criteria

- [ ] `GET /runs/:id/steps`
- [ ] Return array step_run dalam urutan asli DAG (atau sort by `started_at`)
- [ ] Auth required, scope tenant

## Implementation Hints

```ts
export async function listStepRuns(
  db: Db,
  tenantId: string,
  runId: string,
): Promise<StepRun[]> {
  const result = await db.query<StepRun>(
    `SELECT * FROM step_runs
     WHERE tenant_id = $1 AND run_id = $2
     ORDER BY COALESCE(started_at, '1970-01-01') ASC, step_id ASC`,
    [tenantId, runId],
  );
  return result.rows;
}
```

```ts
fastify.get(
  '/runs/:id/steps',
  { preHandler: requireRole('VIEWER') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };

    const run = await getRunById(fastify.db, ctx.tenant_id, id);
    if (!run) return reply.code(404).send({ error: 'not_found' });

    const steps = await listStepRuns(fastify.db, ctx.tenant_id, id);
    return { items: steps };
  },
);
```

## Files Involved

- Update `packages/api/src/repos/step-run.repo.ts`
- Update `packages/api/src/routes/runs.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test runs.steps
```
