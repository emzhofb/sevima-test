# [Epic-07] GET /runs and GET /runs/:id endpoints

**Labels**: `epic-07`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #22 (run repo)

## Context

List run history dengan filter status, range tanggal. Get detail satu run.

## Acceptance Criteria

- [ ] `GET /runs?page=1&pageSize=50&status=FAILED&fromDate=...&toDate=...`
- [ ] `GET /runs/:id` return run + step_runs
- [ ] pageSize max 200
- [ ] Filter rentang waktu max 30 hari (return 400 kalau lebih)

## Implementation Hints

```ts
const ListRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED','TIMED_OUT']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  workflow_id: z.string().uuid().optional(),
});

fastify.get(
  '/runs',
  { preHandler: requireRole('VIEWER') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const parsed = ListRunsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });

    const { fromDate, toDate } = parsed.data;
    if (fromDate && toDate) {
      const days = (toDate.getTime() - fromDate.getTime()) / 86400000;
      if (days > 30) {
        return reply.code(400).send({ error: 'date_range_too_large', max_days: 30 });
      }
    }

    return listRuns(fastify.db, ctx.tenant_id, parsed.data);
  },
);

fastify.get(
  '/runs/:id',
  { preHandler: requireRole('VIEWER') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };

    const run = await getRunById(fastify.db, ctx.tenant_id, id);
    if (!run) return reply.code(404).send({ error: 'not_found' });

    const steps = await listStepRuns(fastify.db, ctx.tenant_id, id);
    return { ...run, step_runs: steps };
  },
);
```

`listRuns` repo:

```ts
export async function listRuns(
  db: Db,
  tenantId: string,
  opts: {
    page?: number;
    pageSize?: number;
    status?: RunStatus;
    fromDate?: Date;
    toDate?: Date;
    workflow_id?: string;
  } = {},
): Promise<{ items: Run[]; total: number; page: number; pageSize: number }> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];

  if (opts.status) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }
  if (opts.workflow_id) {
    params.push(opts.workflow_id);
    conditions.push(`workflow_id = $${params.length}`);
  }
  if (opts.fromDate) {
    params.push(opts.fromDate);
    conditions.push(`started_at >= $${params.length}`);
  }
  if (opts.toDate) {
    params.push(opts.toDate);
    conditions.push(`started_at <= $${params.length}`);
  }

  const where = conditions.join(' AND ');
  params.push(pageSize, (page - 1) * pageSize);

  const items = await db.query<Run>(
    `SELECT * FROM runs WHERE ${where}
     ORDER BY started_at DESC NULLS FIRST, created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM runs WHERE ${where}`,
    params.slice(0, params.length - 2),
  );

  return {
    items: items.rows,
    total: Number(total.rows[0].count),
    page, pageSize,
  };
}
```

## Files Involved

- Update `packages/api/src/repos/run.repo.ts`
- `packages/api/src/routes/runs.ts`
- Test files

## How to Verify

```bash
pnpm -F @flowforge/api test routes/runs
```
