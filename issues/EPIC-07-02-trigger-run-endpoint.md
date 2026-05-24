# [Epic-07] POST /workflows/:id/runs (trigger run)

**Labels**: `epic-07`, `area-api`
**Estimate**: 2 jam
**Depends on**: #22 (run repo), #50 (workflow create), Epic 07 broker setup

## Context

Trigger eksekusi: create row di `runs`, enqueue ke broker, return 202.

## Acceptance Criteria

- [ ] `POST /workflows/:id/runs` body: `{ input?: object }`
- [ ] Role minimum EDITOR
- [ ] Validate workflow exists + tenant match
- [ ] Bind run ke `version_id` dari `workflows.current_version`
- [ ] Insert ke `runs` dengan status PENDING
- [ ] Enqueue ke Redis stream `flowforge:runs`
- [ ] Audit log `run.trigger`
- [ ] Return 202 dengan `{ run_id }`

## Implementation Hints

```ts
import { withTransaction } from '@flowforge/shared';

const TriggerRunSchema = z.object({
  input: z.record(z.unknown()).default({}),
});

fastify.post(
  '/workflows/:id/runs',
  { preHandler: requireRole('EDITOR') },
  async (request, reply) => {
    const ctx = request.ctx!;
    const { id: workflowId } = request.params as { id: string };

    const parsed = TriggerRunSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    // Fetch workflow + current version
    const wf = await getWorkflowById(fastify.db, ctx.tenant_id, workflowId);
    if (!wf) return reply.code(404).send({ error: 'workflow_not_found' });

    // Create run
    const run = await createRun(fastify.db, {
      tenant_id: ctx.tenant_id,
      workflow_id: workflowId,
      version_id: wf.version.id,
      trigger_type: 'MANUAL',
      input: parsed.data.input,
    });

    // Enqueue
    await fastify.broker.enqueue('flowforge:runs', {
      run_id: run.id,
      tenant_id: run.tenant_id,
    });

    await writeAuditLog(fastify.db, {
      tenant_id: ctx.tenant_id,
      user_id: ctx.user_id,
      action: 'run.trigger',
      resource_type: 'run',
      resource_id: run.id,
      request_id: ctx.request_id,
    });

    return reply.code(202).send({ run_id: run.id });
  },
);
```

Test:

```ts
it('triggers run, returns 202', async () => {
  const wf = await createWorkflowFixture(...);
  const res = await app.inject({
    method: 'POST',
    url: `/workflows/${wf.id}/runs`,
    headers: { authorization: `Bearer ${editorToken}` },
    payload: { input: { foo: 'bar' } },
  });
  expect(res.statusCode).toBe(202);
  expect(res.json().run_id).toBeDefined();
});

it('viewer role gets 403', async () => {
  const wf = await createWorkflowFixture(...);
  const res = await app.inject({
    method: 'POST', url: `/workflows/${wf.id}/runs`,
    headers: { authorization: `Bearer ${viewerToken}` },
    payload: {},
  });
  expect(res.statusCode).toBe(403);
});
```

## Files Involved

- Update `packages/api/src/routes/workflows.ts` atau `routes/runs.ts`
- Update `packages/api/src/app.ts` untuk decorate broker
- Test file

## How to Verify

```bash
pnpm -F @flowforge/api test runs.trigger
```
