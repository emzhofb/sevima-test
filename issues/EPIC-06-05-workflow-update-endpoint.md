# [Epic-06] PATCH /workflows/:id (creates new version)

**Labels**: `epic-06`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #50

## Context

Update workflow = bikin versi baru. Versi lama tidak diubah.

## Acceptance Criteria

- [ ] `PATCH /workflows/:id` body: `{ definition }`
- [ ] Role minimum EDITOR
- [ ] Validate definition via parser
- [ ] `updateWorkflow` repository menambah `current_version`
- [ ] Audit log `workflow.update`
- [ ] Test: versi lama masih ada di DB setelah update

## Implementation Hints

```ts
fastify.patch(
  '/workflows/:id',
  { preHandler: requireRole('EDITOR') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id } = request.params as { id: string };
    const parsed = z.object({ definition: z.unknown() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    const defResult = parse(JSON.stringify(parsed.data.definition));
    if (!defResult.ok) {
      return reply.code(400).send({ error: 'invalid_definition', errors: defResult.errors });
    }

    const wf = await updateWorkflow(fastify.db, ctx.tenant_id, id, defResult.definition, ctx.user_id);
    if (!wf) return reply.code(404).send({ error: 'not_found' });

    await writeAuditLog(fastify.db, {
      tenant_id: ctx.tenant_id,
      user_id: ctx.user_id,
      action: 'workflow.update',
      resource_type: 'workflow',
      resource_id: wf.id,
      request_id: ctx.request_id,
      metadata: { new_version: wf.current_version },
    });

    return wf;
  },
);
```

Test for version immutability:

```ts
it('PATCH creates new version, old version still exists', async () => {
  const wf = await createWorkflow(...);
  expect(wf.current_version).toBe(1);

  await app.inject({ method: 'PATCH', url: `/workflows/${wf.id}`, headers, payload: { definition: defV2 } });

  // Get version 1 explicitly
  const v1 = await app.inject({ method: 'GET', url: `/workflows/${wf.id}?version=1`, headers });
  expect(v1.statusCode).toBe(200);
  expect(v1.json().version.definition).toEqual(defV1);

  // Get current
  const current = await app.inject({ method: 'GET', url: `/workflows/${wf.id}`, headers });
  expect(current.json().current_version).toBe(2);
});
```

## Files Involved

- Update `packages/api/src/routes/workflows.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/api test workflows.update
```
