import type { FastifyPluginAsync } from 'fastify';
import { requireRole } from '@flowforge/auth';
import { getWorkflowById } from '../repos/workflow.repo.js';
import {
  rotateWebhookSecret,
  computeWebhookSignature,
  verifyWebhookSignatureHmac,
} from '../repos/webhook.repo.js';

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
};
