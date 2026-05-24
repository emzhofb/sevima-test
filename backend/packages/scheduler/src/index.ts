import { loadConfig, createDbClient, createLogger, RedisStreamBroker, startMetricsServer } from '@flowforge/shared';
import Redis from 'ioredis';
import { schedulerTick } from './tick.js';

export async function startSchedulerService(intervalMs = 5000): Promise<void> {
  const config = loadConfig();
  const log = createLogger('scheduler');
  const db = createDbClient(config);
  const redis = new Redis(config.REDIS_URL);
  const broker = new RedisStreamBroker(redis);

  let running = true;
  process.on('SIGINT', () => {
    running = false;
  });
  process.on('SIGTERM', () => {
    running = false;
  });

  log.info('Scheduler started');

  const stopMetrics = startMetricsServer(Number(process.env.PORT ?? 3004));

  while (running) {
    try {
      const triggered = await schedulerTick(db, broker);
      if (triggered > 0) {
        log.info({ triggered }, 'Scheduler triggered runs');
      }
    } catch (err) {
      log.error({ err }, 'Scheduler tick error');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  log.info('Scheduler shutting down');
  stopMetrics();
  await db.end();
  redis.disconnect();
}
