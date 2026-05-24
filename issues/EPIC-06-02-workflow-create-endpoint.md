# [Epic-06] POST /workflows endpoint

**Labels**: `epic-06`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #20 (workflow repo), #41 (auth middleware), #28 (parser)

## Context

Create workflow. Validation: parser harus pass, role >= EDITOR.

## Acceptance Criteria

- [ ] `POST /workflows` route
- [ ] Body: `{ name, definition }`
- [ ] Auth required, role minimum EDITOR
- [ ] Validate definition via parser → 400 jika invalid dengan list errors
- [ ] Insert via `createWorkflow` repository
- [ ] Audit log: action `workflow.create`
- [ ] Return 201 dengan workflow + version
- [ ] Test: valid → 201, invalid def → 400, no auth → 401, viewer role → 403

## Implementation Hints

```ts
// packages/api/src/routes/workflows.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '@flowforge/auth';
import { parse } from '@flowforge/parser';
import { createWorkflow } from '../repos/workflow.repo.js';
import { writeAuditLog } from '../repos/audit.repo.js';

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  definition: z.unknown(),
});

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/workflows',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const parsed = CreateWorkflowSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.flatten() });
      }

      const defResult = parse(JSON.stringify(parsed.data.definition));
      if (!defResult.ok) {
        return reply.code(400).send({ error: 'invalid_definition', errors: defResult.errors });
      }

      const wf = await createWorkflow(fastify.db, {
        tenant_id: ctx.tenant_id,
        name: parsed.data.name,
        definition: defResult.definition,
        created_by: ctx.user_id,
      });

      await writeAuditLog(fastify.db, {
        tenant_id: ctx.tenant_id,
        user_id: ctx.user_id,
        action: 'workflow.create',
        resource_type: 'workflow',
        resource_id: wf.id,
        request_id: ctx.request_id,
      });

      return reply.code(201).send(wf);
    },
  );
};
```

Test outline:

```ts
it('creates workflow with valid definition', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/workflows',
    headers: { authorization: `Bearer ${editorToken}` },
    payload: {
      name: 'test',
      definition: {
        name: 'test', timeout_sec: 60,
        steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
      },
    },
  });
  expect(res.statusCode).toBe(201);
  expect(res.json().current_version).toBe(1);
});

it('rejects invalid definition (cycle) with 400', async () => {
  const res = await app.inject({
    method: 'POST', url: '/workflows',
    headers: { authorization: `Bearer ${editorToken}` },
    payload: { name: 'cyclic', definition: { /* steps a depends b, b depends a */ } },
  });
  expect(res.statusCode).toBe(400);
});

it('viewer role gets 403', async () => {
  const res = await app.inject({
    method: 'POST', url: '/workflows',
    headers: { authorization: `Bearer ${viewerToken}` },
    payload: { name: 'x', definition: validDef },
  });
  expect(res.statusCode).toBe(403);
});
```

## Files Involved

- `packages/api/src/routes/workflows.ts`
- `packages/api/src/routes/workflows.create.test.ts`
- `packages/api/src/repos/audit.repo.ts` (jika belum ada)

## How to Verify

```bash
pnpm -F @flowforge/api test workflows.create
```
