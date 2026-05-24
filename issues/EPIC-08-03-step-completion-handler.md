# [Epic-08] Step completion event handler

**Labels**: `epic-08`, `area-orchestrator`
**Estimate**: 3 jam
**Depends on**: #64

## Context

Setelah worker selesai eksekusi step, ia kirim event ke stream `flowforge:step-events`. Orchestrator subscribe stream ini, update step_run, compute ready set baru, enqueue step lanjutan.

## Acceptance Criteria

- [ ] Function `handleStepEvent(db, broker, event)`
- [ ] Event types: `STEP_SUCCEEDED`, `STEP_FAILED`
- [ ] Idempotent via processed_events table
- [ ] Update step_run status sesuai event
- [ ] Recompute ready set, enqueue step baru
- [ ] Kalau semua step done → run SUCCEEDED, kalau ada FAILED + tidak continue_on_failure → run FAILED
- [ ] Test integration

## Implementation Hints

```ts
// packages/orchestrator/src/handle-step-event.ts
import { computeReadySet } from '@flowforge/parser';

export type StepEvent = {
  event_id: string; // unique, used for dedup
  type: 'STEP_SUCCEEDED' | 'STEP_FAILED';
  run_id: string;
  step_id: string;
  output?: unknown;
  error?: string;
  attempt: number;
};

export async function handleStepEvent(
  db: Db,
  broker: Broker,
  event: StepEvent,
): Promise<void> {
  await withTransaction(db, async (client) => {
    // Dedup
    const dedup = await client.query(
      `INSERT INTO processed_events (event_id) VALUES ($1)
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [event.event_id],
    );
    if (dedup.rows.length === 0) {
      // Already processed
      return;
    }

    // Lock run
    const runRes = await client.query(
      'SELECT * FROM runs WHERE id = $1 FOR UPDATE',
      [event.run_id],
    );
    const run = runRes.rows[0];
    if (!run || ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(run.status)) {
      // Run already terminal, ignore event
      return;
    }

    // Load workflow definition
    const verRes = await client.query(
      'SELECT definition FROM workflow_versions WHERE id = $1',
      [run.version_id],
    );
    const definition = verRes.rows[0].definition;
    const stepSpec = definition.steps.find((s: any) => s.id === event.step_id);

    // Update step_run status
    if (event.type === 'STEP_SUCCEEDED') {
      await client.query(
        `UPDATE step_runs SET status = 'SUCCEEDED', output = $1, finished_at = now()
         WHERE run_id = $2 AND step_id = $3`,
        [event.output ?? null, event.run_id, event.step_id],
      );
    } else {
      // STEP_FAILED
      await client.query(
        `UPDATE step_runs SET status = 'FAILED', error = $1, finished_at = now()
         WHERE run_id = $2 AND step_id = $3`,
        [event.error ?? null, event.run_id, event.step_id],
      );
    }

    // Check if run should fail
    if (event.type === 'STEP_FAILED' && !stepSpec.continue_on_failure) {
      await client.query(
        `UPDATE runs SET status = 'FAILED', finished_at = now() WHERE id = $1`,
        [event.run_id],
      );
      return;
    }

    // Compute current completed set
    const completedRes = await client.query(
      `SELECT step_id FROM step_runs
       WHERE run_id = $1 AND status IN ('SUCCEEDED','SKIPPED','FAILED')`,
      [event.run_id],
    );
    const completed = new Set<string>(completedRes.rows.map((r: any) => r.step_id));

    const ready = computeReadySet(definition, completed);
    const allStepIds = new Set<string>(definition.steps.map((s: any) => s.id));

    if (ready.size === 0 && completed.size === allStepIds.size) {
      // All done, mark run SUCCEEDED
      await client.query(
        `UPDATE runs SET status = 'SUCCEEDED', finished_at = now() WHERE id = $1`,
        [event.run_id],
      );
      return;
    }

    // Enqueue ready steps that haven't been enqueued yet
    for (const stepId of ready) {
      const existing = await client.query(
        'SELECT status FROM step_runs WHERE run_id = $1 AND step_id = $2',
        [event.run_id, stepId],
      );
      if (existing.rows.length > 0) continue; // Already created

      await client.query(
        `INSERT INTO step_runs (run_id, tenant_id, step_id, status, attempt)
         VALUES ($1, $2, $3, 'READY', 1)`,
        [event.run_id, run.tenant_id, stepId],
      );

      await broker.enqueue('flowforge:steps', {
        run_id: event.run_id,
        step_id: stepId,
        tenant_id: run.tenant_id,
        attempt: '1',
      });
    }
  });
}
```

## Files Involved

- `packages/orchestrator/src/handle-step-event.ts`
- `packages/orchestrator/src/handle-step-event.test.ts`

## How to Verify

Test setup workflow `a → b`, simulate `STEP_SUCCEEDED` event for `a`, verify `b` enqueued.

```bash
pnpm -F @flowforge/orchestrator test handle-step-event
```
