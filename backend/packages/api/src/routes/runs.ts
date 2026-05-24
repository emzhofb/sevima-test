import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '@flowforge/auth';
import { getRunById, listRuns, transitionRunStatus, IllegalStateTransitionError } from '../repos/run.repo.js';
import { listStepRuns } from '../repos/step-run.repo.js';
import { writeAuditLog } from '../repos/audit.repo.js';
import { withTransaction } from '@flowforge/shared';

const ListRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  workflow_id: z.string().uuid().optional(),
});

export const runRoutes: FastifyPluginAsync = async (fastify) => {
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
      // Strip undefined values to satisfy exactOptionalPropertyTypes
      const queryOpts = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined)
      );

      return listRuns(fastify.db, ctx.tenant_id, queryOpts);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/runs/:id',
    { preHandler: requireRole('VIEWER') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;

      const run = await getRunById(fastify.db, ctx.tenant_id, id);
      if (!run) return reply.code(404).send({ error: 'not_found' });

      const steps = await listStepRuns(fastify.db, ctx.tenant_id, id);
      return { ...run, step_runs: steps };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/runs/:id/cancel',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;

      const run = await getRunById(fastify.db, ctx.tenant_id, id);
      if (!run) return reply.code(404).send({ error: 'not_found' });

      try {
        await withTransaction(fastify.db, async (client) => {
          await transitionRunStatus(client, id, 'CANCELLED');
        });
      } catch (err) {
        if (err instanceof IllegalStateTransitionError) {
          return reply.code(409).send({ error: 'cannot_cancel', current_status: run.status });
        }
        throw err;
      }

      await writeAuditLog(fastify.db, {
        tenant_id: ctx.tenant_id,
        user_id: ctx.user_id,
        action: 'run.cancel',
        resource_type: 'run',
        resource_id: id,
        request_id: ctx.request_id,
      });

      return { status: 'CANCELLED' };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/runs/:id/steps',
    { preHandler: requireRole('VIEWER') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;

      const run = await getRunById(fastify.db, ctx.tenant_id, id);
      if (!run) return reply.code(404).send({ error: 'not_found' });

      const steps = await listStepRuns(fastify.db, ctx.tenant_id, id);
      return { items: steps };
    },
  );
};
