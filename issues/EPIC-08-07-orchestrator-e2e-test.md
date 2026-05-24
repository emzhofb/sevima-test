# [Epic-08] Orchestrator end-to-end integration test

**Labels**: `epic-08`, `area-testing`
**Estimate**: 2 jam
**Depends on**: #63, #64, #65, #66

## Context

Test alur lengkap: trigger run → orchestrator process → simulate worker emit step events → run sukses.

## Acceptance Criteria

- [ ] Test buat workflow dengan 3 step (linear: a → b → c)
- [ ] Trigger run via repository
- [ ] Manual simulate worker: dequeue step, emit STEP_SUCCEEDED event
- [ ] Verify run final status = SUCCEEDED
- [ ] Verify semua step_runs SUCCEEDED dalam urutan benar

## Implementation Hints

```ts
// packages/orchestrator/src/e2e.test.ts
import { describe, it, expect } from 'vitest';
import Redis from 'ioredis';
import { createDbClient, RedisStreamBroker } from '@flowforge/shared';
import { startRun } from './start-run.js';
import { handleStepEvent } from './handle-step-event.js';

describe('orchestrator E2E', () => {
  it('linear DAG completes successfully', async () => {
    const db = createDbClient({ DATABASE_URL: process.env.DATABASE_URL! });
    const redis = new Redis(process.env.REDIS_URL!);
    const broker = new RedisStreamBroker(redis);

    // Setup: create tenant, workflow with 3 steps a→b→c, run
    const { runId, workflowDef } = await setupTestRun(db);

    // Step 1: orchestrator picks up run
    await startRun(db, broker, runId);

    // Step 2: simulate worker dequeueing & completing 'a'
    let msg = await broker.dequeue('flowforge:steps', 'workers', 'test-c1', 1000);
    expect(msg!.payload.step_id).toBe('a');
    await handleStepEvent(db, broker, {
      event_id: 'evt-a',
      type: 'STEP_SUCCEEDED',
      run_id: runId, step_id: 'a', attempt: 1,
    });

    // Step 3: 'b' should now be enqueued
    msg = await broker.dequeue('flowforge:steps', 'workers', 'test-c1', 1000);
    expect(msg!.payload.step_id).toBe('b');
    await handleStepEvent(db, broker, {
      event_id: 'evt-b', type: 'STEP_SUCCEEDED',
      run_id: runId, step_id: 'b', attempt: 1,
    });

    // Step 4: 'c'
    msg = await broker.dequeue('flowforge:steps', 'workers', 'test-c1', 1000);
    expect(msg!.payload.step_id).toBe('c');
    await handleStepEvent(db, broker, {
      event_id: 'evt-c', type: 'STEP_SUCCEEDED',
      run_id: runId, step_id: 'c', attempt: 1,
    });

    // Verify run is SUCCEEDED
    const finalRun = await db.query('SELECT status FROM runs WHERE id = $1', [runId]);
    expect(finalRun.rows[0].status).toBe('SUCCEEDED');
  });
});
```

## Files Involved

- `packages/orchestrator/src/e2e.test.ts`

## How to Verify

```bash
docker compose up -d
pnpm migrate:up
pnpm -F @flowforge/orchestrator test e2e
```
