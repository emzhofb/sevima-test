import Fastify from 'fastify';
import type { Db } from '@flowforge/shared';
import { RedisStreamBroker, type Broker } from '@flowforge/shared';
import { authPlugin, createRateLimitMiddleware } from '@flowforge/auth';
import type { Redis } from 'ioredis';
import { authRoutes } from './routes/auth.js';
import { workflowRoutes } from './routes/workflows.js';
import { runRoutes } from './routes/runs.js';
import { scheduleRoutes } from './routes/schedules.js';
import { webhookRoutes } from './routes/webhooks.js';
import { aiRoutes } from './routes/ai.js';

export interface ApiAppOptions {
  db: Db;
  jwtSecret: string;
  redis: Redis;
  rateLimitConfig?: { limit: number; windowSec: number };
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    redis: Redis;
    broker: Broker;
  }
}

export async function buildApp(opts: ApiAppOptions) {
  const app = Fastify({
    bodyLimit: 1024 * 1024, // 1 MB
    trustProxy: true,
  });

  // Attach database to app context
  app.decorate('db', opts.db);

  // Attach redis to app context
  app.decorate('redis', opts.redis);

  // Attach broker to app context
  const broker = new RedisStreamBroker(opts.redis);
  app.decorate('broker', broker);

  // Rate Limiter
  const rateLimitGuard = createRateLimitMiddleware(
    opts.redis,
    opts.rateLimitConfig || { limit: 600, windowSec: 60 },
  );
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health') || request.url.startsWith('/auth/login')) return;
    return rateLimitGuard(request, reply);
  });

  // Register Auth Plugin
  await app.register(authPlugin, { jwtSecret: opts.jwtSecret });

  // Register Routes
  await app.register(authRoutes, { jwtSecret: opts.jwtSecret });
  await app.register(workflowRoutes);
  await app.register(runRoutes);
  await app.register(scheduleRoutes);
  await app.register(webhookRoutes);
  await app.register(aiRoutes);

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Database health check endpoint
  app.get('/health/db', async (req, reply) => {
    try {
      await opts.db.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      reply.code(503);
      return { status: 'error', message: (err as Error).message };
    }
  });

  // Graceful shutdown hook
  app.addHook('onClose', async () => {
    await opts.db.end();
  });

  return app;
}
