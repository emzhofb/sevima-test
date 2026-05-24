# [Epic-09] Worker package skeleton + step dispatcher

**Labels**: `epic-09`, `area-worker`
**Estimate**: 2 jam
**Depends on**: #56 (broker), #22 (run repo)

## Context

Worker konsumsi `flowforge:steps`, eksekusi step sesuai `type`, emit event ke `flowforge:step-events`.

## Acceptance Criteria

- [ ] `packages/worker/src/index.ts` punya `startWorker()` main loop
- [ ] Konsumsi message dari `flowforge:steps`
- [ ] Dispatch ke handler sesuai step type (HTTP, DELAY, CONDITIONAL, SCRIPT)
- [ ] Update step_run status (READY → RUNNING → SUCCEEDED/FAILED)
- [ ] Emit step event ke orchestrator
- [ ] Graceful shutdown

## Implementation Hints

```ts
// packages/worker/src/index.ts
import { loadConfig, createDbClient, createLogger, RedisStreamBroker, withTransaction } from '@flowforge/shared';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { executeHttp } from './handlers/http.js';
import { executeDelay } from './handlers/delay.js';
import { executeConditional } from './handlers/conditional.js';
import { executeScript } from './handlers/script.js';

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
  process.on('SIGINT', () => { running = false; });

  while (running) {
    const msg = await broker.dequeue(STEP_STREAM, GROUP, CONSUMER, 5000);
    if (!msg) continue;

    const { run_id, step_id, attempt } = msg.payload;
    const tenantId = msg.payload.tenant_id;
    log.info({ run_id, step_id, attempt }, 'Processing step');

    try {
      // Check if run is cancelled
      const runRes = await db.query('SELECT status FROM runs WHERE id = $1', [run_id]);
      if (runRes.rows[0]?.status === 'CANCELLED') {
        await broker.ack(STEP_STREAM, GROUP, msg.id);
        continue;
      }

      // Mark step RUNNING
      await db.query(
        `UPDATE step_runs SET status = 'RUNNING', started_at = COALESCE(started_at, now()), last_heartbeat_at = now()
         WHERE run_id = $1 AND step_id = $2`,
        [run_id, step_id],
      );

      // Load step spec from workflow definition
      const versionRes = await db.query(
        `SELECT v.definition FROM workflow_versions v
         JOIN runs r ON r.version_id = v.id WHERE r.id = $1`,
        [run_id],
      );
      const definition = versionRes.rows[0].definition;
      const stepSpec = definition.steps.find((s: any) => s.id === step_id);

      // Execute
      const outcome = await executeStep(stepSpec, run_id, db);

      // Emit event
      const eventId = randomUUID();
      if (outcome.ok) {
        await broker.enqueue(EVENT_STREAM, {
          event_id: eventId,
          type: 'STEP_SUCCEEDED',
          run_id, step_id, attempt,
          tenant_id: tenantId,
          output: JSON.stringify(outcome.output ?? null),
        });
      } else {
        await broker.enqueue(EVENT_STREAM, {
          event_id: eventId,
          type: 'STEP_FAILED',
          run_id, step_id, attempt,
          tenant_id: tenantId,
          error: outcome.error,
        });
      }

      await broker.ack(STEP_STREAM, GROUP, msg.id);
    } catch (err) {
      log.error({ err, run_id, step_id }, 'Worker error');
    }
  }

  await db.end();
  redis.disconnect();
}

type StepOutcome = { ok: true; output?: unknown } | { ok: false; error: string };

async function executeStep(spec: any, runId: string, db: any): Promise<StepOutcome> {
  switch (spec.type) {
    case 'HTTP': return executeHttp(spec, runId, db);
    case 'DELAY': return executeDelay(spec);
    case 'CONDITIONAL': return executeConditional(spec, runId, db);
    case 'SCRIPT': return executeScript(spec, runId, db);
    default: return { ok: false, error: `Unknown step type: ${spec.type}` };
  }
}
```

## Files Involved

- `packages/worker/src/index.ts`
- `packages/worker/src/server.ts`
- Stub handler files

## How to Verify

```bash
pnpm -F @flowforge/worker dev
# Trigger run yang punya HTTP step → worker process step
```
