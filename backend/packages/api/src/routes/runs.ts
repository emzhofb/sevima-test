import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '@flowforge/auth';
import {
  getRunById,
  listRuns,
  transitionRunStatus,
  IllegalStateTransitionError,
} from '../repos/run.repo.js';
import { listStepRuns } from '../repos/step-run.repo.js';
import { writeAuditLog } from '../repos/audit.repo.js';
import { withTransaction, publishEvent } from '@flowforge/shared';

const ListRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z
    .enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'])
    .optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  workflow_id: z.string().uuid().optional(),
});

export const runRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/runs', { preHandler: requireRole('VIEWER') }, async (request, reply) => {
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
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    );

    return listRuns(fastify.db, ctx.tenant_id, queryOpts);
  });

  fastify.get(
    '/runs/stats',
    { preHandler: requireRole('VIEWER') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const sinceCutoff = new Date(Date.now() - 24 * 3600_000);

      const result = await fastify.db.query(
        `SELECT
           status, COUNT(*) as count,
           AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as avg_duration_sec
         FROM runs
         WHERE tenant_id = $1 AND started_at >= $2
         GROUP BY status`,
        [ctx.tenant_id, sinceCutoff],
      );

      const byStatus: Record<string, { count: number; avg_duration_sec: number }> = {};
      for (const r of result.rows) {
        byStatus[r.status] = {
          count: Number(r.count),
          avg_duration_sec: Number(r.avg_duration_sec ?? 0),
        };
      }

      const activeQuery = await fastify.db.query(
        `SELECT COUNT(*)::int as c FROM runs WHERE tenant_id = $1 AND status IN ('PENDING','RUNNING')`,
        [ctx.tenant_id],
      );
      const active = activeQuery.rows[0]?.c ?? 0;

      return { active, by_status: byStatus };
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

        if (fastify.redis) {
          await publishEvent(fastify.redis, {
            tenant_id: ctx.tenant_id,
            run_id: id,
            type: 'RUN_CANCELLED',
            ts: Date.now(),
          }).catch(() => {});
        }
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

  const LogsQuerySchema = z.object({
    step_id: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  });

  fastify.get<{ Params: { id: string } }>(
    '/runs/:id/logs',
    { preHandler: requireRole('VIEWER') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;

      const run = await getRunById(fastify.db, ctx.tenant_id, id);
      if (!run) return reply.code(404).send({ error: 'not_found' });

      const parsed = LogsQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });

      const conditions: string[] = ['tenant_id = $1', 'run_id = $2'];
      const params: unknown[] = [ctx.tenant_id, id];

      if (parsed.data.step_id) {
        params.push(parsed.data.step_id);
        conditions.push(`step_id = $${params.length}`);
      }

      params.push(parsed.data.pageSize);
      const limitIdx = params.length;
      params.push((parsed.data.page - 1) * parsed.data.pageSize);
      const offsetIdx = params.length;

      const rows = await fastify.db.query(
        `SELECT * FROM logs
         WHERE ${conditions.join(' AND ')}
         ORDER BY ts ASC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );

      return { items: rows.rows };
    },
  );
};
