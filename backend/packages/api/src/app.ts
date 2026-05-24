import Fastify from 'fastify';
import type { Db } from '@flowforge/shared';
import { authPlugin } from '@flowforge/auth';
import { authRoutes } from './routes/auth.js';
import { workflowRoutes } from './routes/workflows.js';

export interface ApiAppOptions {
  db: Db;
  jwtSecret: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export async function buildApp(opts: ApiAppOptions) {
  const app = Fastify({
    bodyLimit: 1024 * 1024, // 1 MB
    trustProxy: true,
  });

  // Attach database to app context
  app.decorate('db', opts.db);

  // Register Auth Plugin
  await app.register(authPlugin, { jwtSecret: opts.jwtSecret });

  // Register Routes
  await app.register(authRoutes, { jwtSecret: opts.jwtSecret });
  await app.register(workflowRoutes);

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
