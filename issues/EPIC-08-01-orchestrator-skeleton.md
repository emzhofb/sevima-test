# [Epic-08] Orchestrator package skeleton + main loop

**Labels**: `epic-08`, `area-orchestrator`
**Estimate**: 2 jam
**Depends on**: #56 (broker), #22 (run repo)

## Context

Orchestrator: process service yang konsumsi `flowforge:runs` stream, baca run + workflow definition, enqueue step pertama ke `flowforge:steps`.

> Versi fresh grad: single replica saja. Multi-replica orchestrator butuh advisory lock yang lebih advanced.

## Acceptance Criteria

- [ ] `packages/orchestrator/src/index.ts` punya `startOrchestrator()` main loop
- [ ] Konsumsi message dari `flowforge:runs` Redis stream
- [ ] Untuk setiap run: load workflow, transition PENDING → RUNNING, enqueue step ready set ke `flowforge:steps`
- [ ] Graceful shutdown (handle SIGINT, finish current message)

## Implementation Hints

```ts
// packages/orchestrator/src/index.ts
import { loadConfig, createDbClient, createLogger, RedisStreamBroker } from '@flowforge/shared';
import Redis from 'ioredis';
import { startRun } from './start-run.js';

const RUN_STREAM = 'flowforge:runs';
const STEP_STREAM = 'flowforge:steps';
const GROUP = 'orchestrator';
const CONSUMER = `orch-${process.pid}`;

export async function startOrchestrator(): Promise<void> {
  const config = loadConfig();
  const log = createLogger('orchestrator');
  const db = createDbClient(config);
  const redis = new Redis(config.REDIS_URL);
  const broker = new RedisStreamBroker(redis);

  await broker.ensureGroup(RUN_STREAM, GROUP);
  await broker.ensureGroup(STEP_STREAM, 'workers');

  let running = true;
  process.on('SIGINT', () => { running = false; });
  process.on('SIGTERM', () => { running = false; });

  log.info('Orchestrator started');

  while (running) {
    try {
      const msg = await broker.dequeue(RUN_STREAM, GROUP, CONSUMER, 5000);
      if (!msg) continue;

      const { run_id, tenant_id } = msg.payload;
      log.info({ run_id, tenant_id }, 'Processing run');

      try {
        await startRun(db, broker, run_id);
        await broker.ack(RUN_STREAM, GROUP, msg.id);
      } catch (err) {
        log.error({ err, run_id }, 'Failed to start run');
        // Don't ack: will be retried (or moved to DLQ in future)
      }
    } catch (err) {
      log.error({ err }, 'Error in orchestrator loop');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  log.info('Orchestrator shutting down');
  await db.end();
  redis.disconnect();
}
```

`packages/orchestrator/src/server.ts`:

```ts
import { startOrchestrator } from './index.js';
startOrchestrator().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Files Involved

- `packages/orchestrator/src/index.ts`
- `packages/orchestrator/src/server.ts`
- `packages/orchestrator/package.json`

## How to Verify

```bash
pnpm -F @flowforge/orchestrator dev
# Logs "Orchestrator started"
# Trigger run dari API → orchestrator log "Processing run"
```
