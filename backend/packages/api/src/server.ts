import { buildApp } from './app.js';
import { loadConfig, createDbClient } from '@flowforge/shared';
import Redis from 'ioredis';

async function start() {
  const config = loadConfig();
  const db = createDbClient(config);
  
  // Use config.REDIS_URL or fallback to localhost
  const redis = new Redis(config.REDIS_URL || 'redis://localhost:6379');

  const app = await buildApp({
    db,
    jwtSecret: config.JWT_SECRET,
    redis,
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
