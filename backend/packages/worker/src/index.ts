import {
  loadConfig,
  createDbClient,
  createLogger,
  RedisStreamBroker,
  computeBackoff,
  appendLogs,
  publishEvent,
} from '@flowforge/shared';
import type { DbClient } from '@flowforge/shared';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { executeHttp } from './handlers/http.js';
import { executeDelay } from './handlers/delay.js';
import { executeConditional } from './handlers/conditional.js';
import { executeScript } from './handlers/script.js';

export type StepOutcome = { ok: true; output?: unknown } | { ok: false; error: string };

async function executeStep(spec: any, runId: string, db: any): Promise<StepOutcome> {
  switch (spec.type) {
    case 'HTTP':
      return executeHttp(spec, runId, db);
    case 'DELAY':
      return executeDelay(spec);
    case 'CONDITIONAL':
      return executeConditional(spec, runId, db);
    case 'SCRIPT':
      return executeScript(spec, runId, db);
    default:
      return { ok: false, error: `Unknown step type: ${spec.type}` };
  }
}

export async function startWorker(): Promise<void> {
  const config = loadConfig();
  const log = createLogger('worker');
  const db = createDbClient(config);
  const redis = new Redis(config.REDIS_URL);
  const broker = new RedisStreamBroker(redis);

  const STEP_STREAM = 'flowforge:steps';
  const EVENT_STREAM = 'flowforge:step-events';
  const GROUP = 'workers';
  const CONSUMER = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

  await broker.ensureGroup(STEP_STREAM, GROUP);

  let running = true;
  process.on('SIGINT', () => {
    running = false;
  });
  process.on('SIGTERM', () => {
    running = false;
  });

  log.info({ consumer: CONSUMER }, 'Worker started');

  while (running) {
    const msg = await broker.dequeue(STEP_STREAM, GROUP, CONSUMER, 5000);
    if (!msg) continue;

    const { run_id, step_id, attempt } = msg.payload;
    const tenantId = msg.payload.tenant_id!;
    const currentAttempt = Number(attempt ?? '1');
    log.info({ run_id, step_id, attempt: currentAttempt }, 'Processing step');

    try {
      // Check if run is cancelled before processing
      const runRes = await db.query('SELECT status FROM runs WHERE id = $1', [run_id]);
      if (runRes.rows[0]?.status === 'CANCELLED') {
        log.info({ run_id, step_id }, 'Skipping step for cancelled run');
        await broker.ack(STEP_STREAM, GROUP, msg.id);
        continue;
      }

      // Mark step RUNNING
      await db.query(
        `UPDATE step_runs SET status = 'RUNNING', started_at = COALESCE(started_at, now()), last_heartbeat_at = now()
         WHERE run_id = $1 AND step_id = $2`,
        [run_id, step_id],
      );

      await publishEvent(redis, {
        tenant_id: tenantId,
        run_id: run_id!,
        step_id: step_id!,
        type: 'STEP_STARTED',
        ts: Date.now(),
      }).catch(() => {});

      // Write start log
      await appendLogs(db, [
        {
          tenant_id: tenantId,
          run_id: run_id!,
          step_id: step_id!,
          ts: new Date(),
          level: 'INFO',
          message: `Step ${step_id} started (attempt ${currentAttempt})`,
        },
      ]).catch(() => {
        /* non-fatal */
      });

      // Load step spec from workflow definition
      const versionRes = await db.query(
        `SELECT v.definition FROM workflow_versions v
         JOIN runs r ON r.version_id = v.id WHERE r.id = $1`,
        [run_id],
      );
      const definition = versionRes.rows[0].definition;
      const stepSpec = definition.steps.find((s: any) => s.id === step_id);

      if (!stepSpec) {
        log.error({ run_id, step_id }, 'Step spec not found in definition');
        await broker.ack(STEP_STREAM, GROUP, msg.id);
        continue;
      }

      // Execute the step
      const outcome = await executeStep(stepSpec, run_id!, db);

      // Write completion log
      await appendLogs(db, [
        {
          tenant_id: tenantId,
          run_id: run_id!,
          step_id: step_id!,
          ts: new Date(),
          level: outcome.ok ? 'INFO' : 'ERROR',
          message: outcome.ok
            ? `Step ${step_id} succeeded`
            : `Step ${step_id} failed: ${outcome.error}`,
          fields: outcome.ok
            ? { output: outcome.output }
            : { error: outcome.error, attempt: currentAttempt },
        },
      ]).catch(() => {
        /* non-fatal */
      });

      if (!outcome.ok) {
        // Check retry policy
        const retry = stepSpec.retry;
        if (retry && currentAttempt < retry.max_attempts) {
          const delay = computeBackoff(currentAttempt + 1, retry);
          log.info(
            { run_id, step_id, attempt: currentAttempt, delay },
            'Retrying step with backoff',
          );

          // Update step_run to READY for next attempt
          await db.query(
            `UPDATE step_runs SET attempt = $1, status = 'READY' WHERE run_id = $2 AND step_id = $3`,
            [currentAttempt + 1, run_id, step_id],
          );

          // Re-enqueue with delay
          setTimeout(() => {
            broker
              .enqueue(STEP_STREAM, {
                run_id: run_id!,
                step_id: step_id!,
                tenant_id: tenantId,
                attempt: String(currentAttempt + 1),
              })
              .catch((err) => log.error({ err }, 'Re-enqueue failed'));
          }, delay);

          await broker.ack(STEP_STREAM, GROUP, msg.id);
          continue;
        }

        // Out of retries: emit STEP_FAILED
        const eventId = randomUUID();
        await broker.enqueue(EVENT_STREAM, {
          event_id: eventId,
          type: 'STEP_FAILED',
          run_id: run_id!,
          step_id: step_id!,
          attempt: String(currentAttempt),
          tenant_id: tenantId,
          error: outcome.error,
        });
      } else {
        // Emit STEP_SUCCEEDED
        const eventId = randomUUID();
        await broker.enqueue(EVENT_STREAM, {
          event_id: eventId,
          type: 'STEP_SUCCEEDED',
          run_id: run_id!,
          step_id: step_id!,
          attempt: String(currentAttempt),
          tenant_id: tenantId,
          output: JSON.stringify(outcome.output ?? null),
        });
      }

      await broker.ack(STEP_STREAM, GROUP, msg.id);
      log.info({ run_id, step_id, ok: outcome.ok }, 'Step completed');
    } catch (err) {
      log.error({ err, run_id, step_id }, 'Worker error processing step');
      // Don't ack: message will be retried
    }
  }

  log.info('Worker shutting down');
  await db.end();
  redis.disconnect();
}
