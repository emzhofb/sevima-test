# [Epic-08] startRun function (load + dispatch first ready set)

**Labels**: `epic-08`, `area-orchestrator`
**Estimate**: 2 jam
**Depends on**: #63

## Context

Function utama orchestrator:
1. Load run + workflow version dari DB
2. Transition run ke RUNNING
3. Compute ready set initial (step tanpa deps)
4. Untuk setiap ready step: insert step_run + enqueue ke step stream

## Acceptance Criteria

- [ ] Function `startRun(db, broker, runId)`
- [ ] Idempotent (re-run safe via processed_events check)
- [ ] Test integration dengan DB

## Implementation Hints

```ts
// packages/orchestrator/src/start-run.ts
import { computeReadySet } from '@flowforge/parser';
import { withTransaction, type Db, type Broker } from '@flowforge/shared';

export async function startRun(
  db: Db,
  broker: Broker,
  runId: string,
): Promise<void> {
  await withTransaction(db, async (client) => {
    // Lock + load run
    const runRes = await client.query(
      'SELECT * FROM runs WHERE id = $1 FOR UPDATE',
      [runId],
    );
    const run = runRes.rows[0];
    if (!run) throw new Error(`Run ${runId} not found`);

    if (run.status !== 'PENDING') {
      // Already started, skip (idempotent)
      return;
    }

    // Load definition from version
    const versionRes = await client.query(
      'SELECT definition FROM workflow_versions WHERE id = $1',
      [run.version_id],
    );
    const definition = versionRes.rows[0].definition;

    // Transition to RUNNING
    await client.query(
      `UPDATE runs SET status = 'RUNNING', started_at = now() WHERE id = $1`,
      [runId],
    );

    // Compute initial ready set
    const ready = computeReadySet(definition, new Set());

    // Insert step_runs as READY for ready set
    for (const stepId of ready) {
      await client.query(
        `INSERT INTO step_runs (run_id, tenant_id, step_id, status, attempt)
         VALUES ($1, $2, $3, 'READY', 1)
         ON CONFLICT DO NOTHING`,
        [runId, run.tenant_id, stepId],
      );
    }

    // Enqueue ready steps to broker
    for (const stepId of ready) {
      await broker.enqueue('flowforge:steps', {
        run_id: runId,
        step_id: stepId,
        tenant_id: run.tenant_id,
        attempt: '1',
      });
    }
  });
}
```

Test:

```ts
it('startRun transitions run to RUNNING and enqueues initial steps', async () => {
  // Create workflow with 2 root steps + 1 dependent
  const wf = await createWorkflow(...);
  const run = await createRun(db, { workflow_id: wf.id, version_id: wf.version.id, ... });

  const enqueued: any[] = [];
  const mockBroker = { enqueue: async (s: string, p: any) => { enqueued.push(p); return 'id'; } };

  await startRun(db, mockBroker as any, run.id);

  const updatedRun = await getRunById(db, ..., run.id);
  expect(updatedRun!.status).toBe('RUNNING');
  expect(enqueued.length).toBe(2); // 2 root steps
});

it('startRun is idempotent: second call no-op', async () => {
  // ... setup
  await startRun(db, broker, run.id);
  await startRun(db, broker, run.id); // should not double-enqueue
});
```

## Files Involved

- `packages/orchestrator/src/start-run.ts`
- `packages/orchestrator/src/start-run.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/orchestrator test start-run
```
