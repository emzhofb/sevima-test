import { loadConfig, createDbClient, createLogger, RedisStreamBroker } from '@flowforge/shared';
import type { Db, Broker } from '@flowforge/shared';
import Redis from 'ioredis';
import { startRun } from './start-run.js';
import { handleStepEvent } from './handle-step-event.js';
import { startTimeoutScanner } from './timeout-scanner.js';

const RUN_STREAM = 'flowforge:runs';
const STEP_EVENT_STREAM = 'flowforge:step-events';
const STEP_STREAM = 'flowforge:steps';
const RUN_GROUP = 'orchestrator';
const EVENT_GROUP = 'orchestrator-events';

let running = true;

async function consumeRuns(db: Db, broker: Broker, consumer: string, log: ReturnType<typeof createLogger>): Promise<void> {
  await broker.ensureGroup(RUN_STREAM, RUN_GROUP);
  await broker.ensureGroup(STEP_STREAM, 'workers');

  while (running) {
    try {
      const msg = await broker.dequeue(RUN_STREAM, RUN_GROUP, consumer, 5000);
      if (!msg) continue;

      const { run_id, tenant_id } = msg.payload;
      log.info({ run_id, tenant_id }, 'Processing run');

      try {
        await startRun(db, broker, run_id);
        await broker.ack(RUN_STREAM, RUN_GROUP, msg.id);
      } catch (err) {
        log.error({ err, run_id }, 'Failed to start run');
        // Don't ack: will be retried
      }
    } catch (err) {
      log.error({ err }, 'Error in run consumer loop');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function consumeStepEvents(db: Db, broker: Broker, consumer: string, log: ReturnType<typeof createLogger>): Promise<void> {
  await broker.ensureGroup(STEP_EVENT_STREAM, EVENT_GROUP);

  while (running) {
    try {
      const msg = await broker.dequeue(STEP_EVENT_STREAM, EVENT_GROUP, consumer, 5000);
      if (!msg) continue;

      try {
        const event = {
          event_id: msg.payload.event_id!,
          type: msg.payload.type as 'STEP_SUCCEEDED' | 'STEP_FAILED',
          run_id: msg.payload.run_id!,
          step_id: msg.payload.step_id!,
          output: msg.payload.output ? JSON.parse(msg.payload.output) : undefined,
          error: msg.payload.error,
          attempt: Number(msg.payload.attempt),
        };

        await handleStepEvent(db, broker, event);
        await broker.ack(STEP_EVENT_STREAM, EVENT_GROUP, msg.id);
      } catch (err) {
        log.error({ err, msg }, 'Failed to process step event');
      }
    } catch (err) {
      log.error({ err }, 'Error in step event consumer loop');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function startOrchestrator(): Promise<void> {
  const config = loadConfig();
  const log = createLogger('orchestrator');
  const db = createDbClient(config);
  const redis = new Redis(config.REDIS_URL);
  const broker = new RedisStreamBroker(redis);

  const CONSUMER = `orch-${process.pid}`;

  process.on('SIGINT', () => { running = false; });
  process.on('SIGTERM', () => { running = false; });

  log.info('Orchestrator started');

  const stopTimeoutScanner = startTimeoutScanner(db);

  try {
    await Promise.all([
      consumeRuns(db, broker, CONSUMER, log),
      consumeStepEvents(db, broker, CONSUMER, log),
    ]);
  } finally {
    stopTimeoutScanner();
    log.info('Orchestrator shutting down');
    await db.end();
    redis.disconnect();
  }
}
