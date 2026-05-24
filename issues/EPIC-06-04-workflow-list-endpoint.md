# [Epic-06] GET /workflows (list with pagination + filter)

**Labels**: `epic-06`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #50

## Context

List dengan pagination, filter `name` substring, scope ke tenant.

## Acceptance Criteria

- [ ] `GET /workflows?page=1&pageSize=20&name=foo`
- [ ] page default 1, min 1
- [ ] pageSize default 20, max 100, min 1
- [ ] Response: `{ items, total, page, pageSize }`
- [ ] Hanya kembalikan workflow milik tenant pemanggil

## Implementation Hints

```ts
const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().optional(),
});

fastify.get('/workflows', { preHandler: requireRole('VIEWER') }, async (request, reply) => {
  const ctx = request.ctx!;
  const parsed = ListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.flatten() });
  }

  const { items, total } = await listWorkflows(fastify.db, ctx.tenant_id, parsed.data);
  return { items, total, page: parsed.data.page, pageSize: parsed.data.pageSize };
});
```

Test:

```ts
it('list returns paginated workflows', async () => {
  // Create 25 workflows
  for (let i = 0; i < 25; i++) {
    await app.inject({ method: 'POST', url: '/workflows', headers, payload: { ... } });
  }

  const res = await app.inject({
    method: 'GET',
    url: '/workflows?page=2&pageSize=10',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.json().items.length).toBe(10);
  expect(res.json().total).toBe(25);
});

it('list filters by name substring', async () => {
  // Create workflows with names 'alpha', 'beta', 'alpha-2'
  const res = await app.inject({
    method: 'GET',
    url: '/workflows?name=alpha',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.json().items.length).toBe(2);
});
```

## Files Involved

- Update `packages/api/src/routes/workflows.ts`
- `packages/api/src/routes/workflows.list.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test workflows.list
```
