# [Epic-06] Fastify app skeleton + healthcheck

**Labels**: `epic-06`, `good-first-issue`, `area-api`
**Estimate**: 1 jam
**Depends on**: #1 (init monorepo), #6 (config), #17 (db client)

## Context

Bootstrap utama API: load config, init DB pool, setup Fastify, register routes, listen.

## Acceptance Criteria

- [ ] `packages/api/src/app.ts` ekspor `buildApp()` yang return Fastify instance
- [ ] `packages/api/src/server.ts` start app di port dari config
- [ ] `GET /health` return `{ status: 'ok' }`
- [ ] `GET /health/db` cek koneksi DB
- [ ] Graceful shutdown handler (SIGINT, SIGTERM)

## Implementation Hints

```bash
pnpm add -F @flowforge/api fastify @flowforge/shared @flowforge/auth
```

```ts
// packages/api/src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import { createDbClient, loadConfig, createLogger, type Db } from '@flowforge/shared';
import { authPlugin } from '@flowforge/auth';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  const log = createLogger('api');
  const db = createDbClient(config);

  const app = Fastify({
    logger: log,
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  app.decorate('db', db);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/db', async (req, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      reply.code(503);
      return { status: 'error', message: (err as Error).message };
    }
  });

  await app.register(authPlugin, { jwtSecret: config.JWT_SECRET });

  app.addHook('onClose', async () => {
    await db.end();
  });

  return app;
}
```

```ts
// packages/api/src/server.ts
import { buildApp } from './app.js';
import { loadConfig } from '@flowforge/shared';

const config = loadConfig();
const app = await buildApp();

const close = async () => {
  await app.close();
  process.exit(0);
};

process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
```

## Files Involved

- `packages/api/src/app.ts`
- `packages/api/src/server.ts`
- `packages/api/package.json`

## How to Verify

```bash
pnpm -F @flowforge/api dev
curl http://localhost:3000/health
# {"status":"ok"}
curl http://localhost:3000/health/db
# {"status":"ok"}
```
