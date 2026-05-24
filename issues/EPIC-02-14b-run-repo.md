# [Epic-02] Run + StepRun repository

**Labels**: `epic-02`, `area-data`
**Estimate**: 2 jam
**Depends on**: #20 (workflow repo)

## Context

CRUD untuk runs + step_runs. Selalu scope ke tenant. Implement state transition validator.

## Acceptance Criteria

- [ ] `createRun({ tenant_id, workflow_id, version_id, trigger_type, input })`
- [ ] `getRunById(tenant_id, run_id)`
- [ ] `listRuns(tenant_id, { page, pageSize, status?, fromDate?, toDate? })`
- [ ] `updateRunStatus(run_id, status, finished_at?)` dengan validasi FSM
- [ ] FSM: `PENDING → RUNNING → {SUCCEEDED | FAILED | CANCELLED | TIMED_OUT}` (terminal tidak bisa diubah)
- [ ] Function `createStepRun` dan `updateStepRun`
- [ ] Test untuk transisi ilegal (terminal → running ditolak)

## Implementation Hints

```ts
import type { Db, DbClient } from '@flowforge/shared';
import type { RunStatus, StepRunStatus, TriggerType } from '@flowforge/shared';

const TERMINAL_RUN_STATUSES: RunStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'];

const VALID_RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
};

export class IllegalStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal transition: ${from} -> ${to}`);
  }
}

export async function createRun(
  db: Db | DbClient,
  input: {
    tenant_id: string;
    workflow_id: string;
    version_id: string;
    trigger_type: TriggerType;
    input: unknown;
  },
): Promise<Run> {
  const res = await db.query<Run>(
    `INSERT INTO runs (tenant_id, workflow_id, version_id, trigger_type, input, status)
     VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING *`,
    [input.tenant_id, input.workflow_id, input.version_id, input.trigger_type, input.input],
  );
  return res.rows[0];
}

export async function transitionRunStatus(
  db: DbClient,
  runId: string,
  toStatus: RunStatus,
): Promise<Run> {
  // Lock + read current
  const cur = await db.query<{ status: RunStatus }>(
    'SELECT status FROM runs WHERE id = $1 FOR UPDATE',
    [runId],
  );
  if (!cur.rows[0]) throw new Error('Run not found');

  const fromStatus = cur.rows[0].status;
  if (!VALID_RUN_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new IllegalStateTransitionError(fromStatus, toStatus);
  }

  const fields: string[] = ['status = $2'];
  const params: unknown[] = [runId, toStatus];
  if (toStatus === 'RUNNING') {
    fields.push('started_at = now()');
  }
  if (TERMINAL_RUN_STATUSES.includes(toStatus)) {
    fields.push('finished_at = now()');
  }

  const res = await db.query<Run>(
    `UPDATE runs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );
  return res.rows[0];
}

export type Run = {
  id: string;
  tenant_id: string;
  workflow_id: string;
  version_id: string;
  status: RunStatus;
  input: unknown;
  trigger_type: TriggerType;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
};
```

Test:

```ts
it('rejects terminal -> running transition', async () => {
  // Setup: create run, transition to SUCCEEDED
  const run = await createRun(db, { ... });
  await withTransaction(db, async (c) => {
    await transitionRunStatus(c, run.id, 'RUNNING');
    await transitionRunStatus(c, run.id, 'SUCCEEDED');
  });
  await expect(
    withTransaction(db, async (c) => {
      await transitionRunStatus(c, run.id, 'RUNNING');
    }),
  ).rejects.toThrow('Illegal transition');
});
```

## Files Involved

- `packages/api/src/repos/run.repo.ts`
- `packages/api/src/repos/run.repo.test.ts`
- `packages/api/src/repos/step-run.repo.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test repos/run
```
