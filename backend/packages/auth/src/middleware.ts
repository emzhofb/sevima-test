import fp from 'fastify-plugin';
import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { verifyJwt } from './jwt.js';
import type { RequestContext, Role } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx?: RequestContext;
  }
}

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

const authPluginCallback: FastifyPluginCallback<{ jwtSecret: string }> = (
  fastify,
  opts,
  done,
) => {
  fastify.decorateRequest('ctx', null);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url;
    if (url.startsWith('/health') || url.startsWith('/auth/login')) return;

    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Missing or malformed Authorization header' });
    }

    const token = auth.slice('Bearer '.length);
    const claims = verifyJwt(token, opts.jwtSecret);
    if (!claims) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
    }

    request.ctx = {
      tenant_id: claims.tenant_id,
      user_id: claims.user_id,
      role: claims.role,
      request_id: (request.headers['x-request-id'] as string) ?? randomUUID(),
    };
  });

  done();
};

export const authPlugin = fp(authPluginCallback, { name: 'auth' });

export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.ctx) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (ROLE_HIERARCHY[request.ctx.role] < ROLE_HIERARCHY[minRole]) {
      return reply.code(403).send({ error: 'forbidden', message: 'Insufficient role' });
    }
  };
}