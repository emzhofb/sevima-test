# [Epic-06] GET /workflows/:id endpoint

**Labels**: `epic-06`, `good-first-issue`, `area-api`
**Estimate**: 1 jam
**Depends on**: #50

## Context

Get workflow by ID dengan optional `?version=N` query.

## Acceptance Criteria

- [ ] `GET /workflows/:id` dengan optional `?version=N`
- [ ] Auth required, role minimum VIEWER
- [ ] Return 404 jika tidak ditemukan ATAU bukan tenant pemanggil
- [ ] Return workflow + version

## Implementation Hints

```ts
fastify.get(
  '/workflows/:id',
  { preHandler: requireRole('VIEWER') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };
    const versionRaw = (request.query as { version?: string }).version;
    const version = versionRaw ? Number(versionRaw) : undefined;

    if (versionRaw && (Number.isNaN(version) || version! < 1)) {
      return reply.code(400).send({ error: 'invalid_version' });
    }

    const wf = await getWorkflowById(fastify.db, ctx.tenant_id, id, version);
    if (!wf) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return wf;
  },
);
```

Test:

```ts
it('returns workflow for owner', async () => {
  const created = await createTestWorkflow(...);
  const res = await app.inject({
    method: 'GET',
    url: `/workflows/${created.id}`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().id).toBe(created.id);
});

it('returns 404 for cross-tenant access', async () => {
  const created = await createTestWorkflow(tenantA, ...);
  const res = await app.inject({
    method: 'GET',
    url: `/workflows/${created.id}`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  expect(res.statusCode).toBe(404);
});
```

## Files Involved

- Update `packages/api/src/routes/workflows.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/api test workflows
```
