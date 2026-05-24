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
  fastify.post('/workflows', { preHandler: requireRole('EDITOR') }, async (request, reply) => {
    const ctx = request.ctx;
    if (!ctx) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Missing request context' });
    }

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
  });
};
