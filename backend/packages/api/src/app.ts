import Fastify from 'fastify';
import type { Db } from '@flowforge/shared';

export interface ApiAppOptions {
  db: Db;
  jwtSecret: string;
}

export async function buildApp(opts: ApiAppOptions) {
  const app = Fastify({
    bodyLimit: 1024 * 1024, // 1 MB
  });

  // Attach database to app context
  app.decorate('db', opts.db);

  return app;
}
