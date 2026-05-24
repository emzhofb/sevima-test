import type { FastifyPluginAsync } from 'fastify';
import { requireRole } from '@flowforge/auth';
import { getWorkflowById } from '../repos/workflow.repo.js';
import { createRun } from '../repos/run.repo.js';
import {
  rotateWebhookSecret,
  computeWebhookSignature,
  verifyWebhookSignatureHmac,
} from '../repos/webhook.repo.js';
import { createHmac, timingSafeEqual } from 'crypto';
import { publishEvent } from '@flowforge/shared';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /workflows/:id/webhook/rotate-secret
  // Returns the new plaintext secret (shown once only)
  fastify.post<{ Params: { id: string } }>(
    '/workflows/:id/webhook/rotate-secret',
    { preHandler: requireRole('ADMIN') },
    async (request, reply) => {
      const ctx = request.ctx!;
      const { id } = request.params;

      const workflow = await getWorkflowById(fastify.db, ctx.tenant_id, id);
      if (!workflow) return reply.code(404).send({ error: 'workflow_not_found' });

      const secret = await rotateWebhookSecret(fastify.db, ctx.tenant_id, id);

      return reply.code(200).send({
        secret,
        message: 'Store this secret securely. It will not be shown again.',
      });
    },
  );

  // POST /webhooks/:tenant_slug/:workflow_id - Webhook Receiver
  fastify.post<{ Params: { tenant_slug: string; workflow_id: string } }>(
    '/webhooks/:tenant_slug/:workflow_id',
    async (request, reply) => {
      const { tenant_slug, workflow_id } = request.params;
      const sig = request.headers['x-flowforge-signature'] as string;
      const tsRaw = request.headers['x-flowforge-timestamp'] as string;
      if (!sig || !tsRaw) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const ts = Number(tsRaw);
      if (!Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      // Find tenant + workflow + current version
      const wfRes = await fastify.db.query(
        `SELECT w.id, w.tenant_id, w.webhook_secret, w.current_version, v.id as version_id
         FROM workflows w
         JOIN tenants t ON t.id = w.tenant_id
         JOIN workflow_versions v ON v.workflow_id = w.id AND v.version = w.current_version
         WHERE t.slug = $1 AND w.id = $2`,
        [tenant_slug, workflow_id],
      );
      const wf = wfRes.rows[0];
      if (!wf || !wf.webhook_secret) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const body = JSON.stringify(request.body ?? {});
      const expectedSig = createHmac('sha256', wf.webhook_secret).update(`${ts}.${body}`).digest('hex');

      try {
        const sigBuffer = Buffer.from(sig, 'hex');
        const expectedBuffer = Buffer.from(expectedSig, 'hex');
        if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
          return reply.code(401).send({ error: 'unauthorized' });
        }
      } catch {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      // Trigger run using createRun repository function
      const run = await createRun(fastify.db, {
        tenant_id: wf.tenant_id,
        workflow_id: wf.id,
        version_id: wf.version_id,
        trigger_type: 'WEBHOOK',
        input: request.body ?? {},
      });

      await fastify.broker.enqueue('flowforge:runs', {
        run_id: run.id,
        tenant_id: wf.tenant_id,
      });

      await publishEvent(fastify.redis, {
        tenant_id: wf.tenant_id,
        run_id: run.id,
        type: 'RUN_QUEUED',
        ts: Date.now(),
      }).catch(() => {});

      return reply.code(202).send({ run_id: run.id });
    },
  );
};
