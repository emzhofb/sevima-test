import { buildApp } from './app.js';
import { loadConfig, createDbClient } from '@flowforge/shared';

async function start() {
  const config = loadConfig();
  const db = createDbClient(config);

  const app = await buildApp({
    db,
    jwtSecret: config.JWT_SECRET,
  });

  const close = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  const address = await app.listen({ port: config.PORT || 3000, host: '0.0.0.0' });
  console.log(`Server listening at ${address}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
