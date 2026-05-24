import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '@flowforge/auth';
import { parse } from '@flowforge/parser';
import {
  createWorkflow,
  getWorkflowById,
  listWorkflows,
  updateWorkflow,
  rollbackWorkflow,
  deleteWorkflow,
} from '../repos/workflow.repo.js';
import { createRun } from '../repos/run.repo.js';
import { writeAuditLog } from '../repos/audit.repo.js';
import { publishEvent } from '@flowforge/shared';

const TriggerRunSchema = z.object({
  input: z.record(z.unknown()).default({}),
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  definition: z.unknown(),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().optional(),
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

  fastify.get('/workflows', { preHandler: requireRole('VIEWER') }, async (request, reply) => {
    const ctx = request.ctx;
    if (!ctx) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Missing request context' });
    }

    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.flatten() });
    }

    const { page, pageSize, name } = parsed.data;
    const { items, total } = await listWorkflows(fastify.db, ctx.tenant_id, {
      page,
      pageSize,
      ...(name !== undefined ? { name } : {}),
    });
    return { items, total, page, pageSize };
  });

  fastify.get<{ Params: { id: string }; Querystring: { version?: string } }>(
    '/workflows/:id',
    { preHandler: requireRole('VIEWER') },
    async (request, reply) => {
      const ctx = request.ctx;
      if (!ctx) {
        return reply.code(401).send({ error: 'unauthorized', message: 'Missing request context' });
      }

      const versionRaw = request.query.version;
      const version = versionRaw ? Number(versionRaw) : undefined;

      if (versionRaw && (Number.isNaN(version) || version! < 1)) {
        return reply.code(400).send({ error: 'invalid_version' });
      }

      const wf = await getWorkflowById(fastify.db, ctx.tenant_id, request.params.id, version);
      if (!wf) {
        return reply.code(404).send({ error: 'not_found' });
      }

      return wf;
    },
  );
  fastify.patch<{ Params: { id: string } }>(
    '/workflows/:id',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx;
      if (!ctx) {
        return reply.code(401).send({ error: 'unauthorized', message: 'Missing request context' });
      }

      const PatchSchema = z.object({
        definition: z
          .unknown()
          .refine((v) => v !== undefined, { message: 'definition is required' }),
      });
      const parsed = PatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.flatten() });
      }

      const defResult = parse(JSON.stringify(parsed.data.definition));
      if (!defResult.ok) {
        return reply.code(400).send({ error: 'invalid_definition', errors: defResult.errors });
      }

      const wf = await updateWorkflow(
        fastify.db,
        ctx.tenant_id,
        request.params.id,
        defResult.definition,
        ctx.user_id,
      );
      if (!wf) {
        return reply.code(404).send({ error: 'not_found' });
      }

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

  fastify.post<{ Params: { id: string } }>(
    '/workflows/:id/rollback',
    { preHandler: requireRole('ADMIN') },
    async (request, reply) => {
      const ctx = request.ctx;
      if (!ctx) {
        return reply.code(401).send({ error: 'unauthorized', message: 'Missing request context' });
      }

      const parsed = z.object({ targetVersion: z.number().int().min(1) }).safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.flatten() });
      }

      try {
        const wf = await rollbackWorkflow(
          fastify.db,
          ctx.tenant_id,
          request.params.id,
          parsed.data.targetVersion,
          ctx.user_id,
        );

        await writeAuditLog(fastify.db, {
          tenant_id: ctx.tenant_id,
          user_id: ctx.user_id,
          action: 'workflow.rollback',
          resource_type: 'workflow',
          resource_id: wf.id,
          request_id: ctx.request_id,
          metadata: { rolled_back_to: parsed.data.targetVersion, new_version: wf.current_version },
        });

        return wf;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Version'))
          return reply.code(400).send({ error: 'invalid_target_version' });
        if (msg.includes('not found')) return reply.code(404).send({ error: 'not_found' });
        throw err;
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/workflows/:id',
    { preHandler: requireRole('ADMIN') },
    async (request, reply) => {
      const ctx = request.ctx;
      if (!ctx) {
        return reply.code(401).send({ error: 'unauthorized', message: 'Missing request context' });
      }

      const deleted = await deleteWorkflow(fastify.db, ctx.tenant_id, request.params.id);
      if (!deleted) return reply.code(404).send({ error: 'not_found' });

      await writeAuditLog(fastify.db, {
        tenant_id: ctx.tenant_id,
        user_id: ctx.user_id,
        action: 'workflow.delete',
        resource_type: 'workflow',
        resource_id: request.params.id,
        request_id: ctx.request_id,
      });

      return reply.code(204).send();
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/workflows/:id/runs',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx;
      if (!ctx) return reply.code(401).send({ error: 'unauthorized' });

      const parsed = TriggerRunSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

      const workflowId = request.params.id;
      const wf = await getWorkflowById(fastify.db, ctx.tenant_id, workflowId);
      if (!wf) return reply.code(404).send({ error: 'workflow_not_found' });

      const run = await createRun(fastify.db, {
        tenant_id: ctx.tenant_id,
        workflow_id: workflowId,
        version_id: wf.version.id,
        trigger_type: 'MANUAL',
        input: parsed.data.input,
      });

      await fastify.broker.enqueue('flowforge:runs', {
        run_id: run.id,
        tenant_id: run.tenant_id,
      });

      await publishEvent(fastify.redis, {
        tenant_id: run.tenant_id,
        run_id: run.id,
        type: 'RUN_QUEUED',
        ts: Date.now(),
      }).catch(() => {});

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
};
