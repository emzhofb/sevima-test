import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '@flowforge/auth';
import { getWorkflowById } from '../repos/workflow.repo.js';
import {
  createSchedule,
  getScheduleById,
  listSchedules,
  updateSchedule,
  deleteSchedule,
} from '../repos/schedule.repo.js';

// Import cron-parser dynamically to allow testing without the package
async function validateCron(expr: string): Promise<boolean> {
  try {
    const mod = await import('cron-parser');
    mod.default.parseExpression(expr);
    return true;
  } catch {
    return false;
  }
}

const CreateScheduleSchema = z.object({
  cron_expr: z.string().min(1),
  tz: z.string().default('UTC'),
  enabled: z.boolean().default(true),
});

const PatchScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  cron_expr: z.string().min(1).optional(),
});

export const scheduleRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /workflows/:id/schedules — create schedule
  fastify.post<{ Params: { id: string } }>(
    '/workflows/:id/schedules',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id: workflowId } = request.params;

      const workflow = await getWorkflowById(fastify.db, ctx.tenant_id, workflowId);
      if (!workflow) return reply.code(404).send({ error: 'workflow_not_found' });

      const parsed = CreateScheduleSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

      const valid = await validateCron(parsed.data.cron_expr);
      if (!valid) return reply.code(400).send({ error: 'invalid_cron_expression' });

      // Compute initial next_run_at
      const cronMod = await import('cron-parser');
      const interval = cronMod.default.parseExpression(parsed.data.cron_expr, {
        tz: parsed.data.tz,
      });
      const nextRunAt = interval.next().toDate();

      const schedule = await createSchedule(fastify.db, {
        tenant_id: ctx.tenant_id,
        workflow_id: workflowId,
        cron_expr: parsed.data.cron_expr,
        tz: parsed.data.tz,
        next_run_at: nextRunAt,
        enabled: parsed.data.enabled,
      });

      return reply.code(201).send(schedule);
    },
  );

  // GET /workflows/:id/schedules — list schedules
  fastify.get<{ Params: { id: string } }>(
    '/workflows/:id/schedules',
    { preHandler: requireRole('VIEWER') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id: workflowId } = request.params;

      const workflow = await getWorkflowById(fastify.db, ctx.tenant_id, workflowId);
      if (!workflow) return reply.code(404).send({ error: 'workflow_not_found' });

      const schedules = await listSchedules(fastify.db, ctx.tenant_id, workflowId);
      return { items: schedules };
    },
  );

  // PATCH /schedules/:id — update schedule (toggle enabled, update cron)
  fastify.patch<{ Params: { id: string } }>(
    '/schedules/:id',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;

      const existing = await getScheduleById(fastify.db, ctx.tenant_id, id);
      if (!existing) return reply.code(404).send({ error: 'not_found' });

      const parsed = PatchScheduleSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

      // Validate new cron expression if provided
      if (parsed.data.cron_expr) {
        const valid = await validateCron(parsed.data.cron_expr);
        if (!valid) return reply.code(400).send({ error: 'invalid_cron_expression' });
      }

      const updated = await updateSchedule(fastify.db, ctx.tenant_id, id, parsed.data);
      if (!updated) return reply.code(400).send({ error: 'no_fields_to_update' });

      return updated;
    },
  );

  // DELETE /schedules/:id — delete schedule
  fastify.delete<{ Params: { id: string } }>(
    '/schedules/:id',
    { preHandler: requireRole('EDITOR') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;
      const deleted = await deleteSchedule(fastify.db, ctx.tenant_id, id);
      if (!deleted) return reply.code(404).send({ error: 'not_found' });

      return reply.code(204).send();
    },
  );
};
