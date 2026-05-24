import type { Db, DbClient, StepRun, StepRunStatus } from '@flowforge/shared';
import { IllegalStateTransitionError } from './run.repo.js';

export { IllegalStateTransitionError };

export async function createStepRun(
  db: Db | DbClient,
  input: {
    run_id: string;
    tenant_id: string;
    step_id: string;
    attempt?: number;
  },
): Promise<StepRun> {
  const result = await db.query<StepRun>(
    `INSERT INTO step_runs (run_id, tenant_id, step_id, attempt, status)
     VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *`,
    [input.run_id, input.tenant_id, input.step_id, input.attempt ?? 1],
  );

  const stepRun = result.rows[0];
  if (!stepRun) {
    throw new Error('Failed to create step run');
  }
  return stepRun;
}

export async function transitionStepRunStatus(
  db: Db | DbClient,
  runId: string,
  stepId: string,
  toStatus: StepRunStatus,
  patch: {
    attempt?: number;
    output?: unknown;
    error?: string | null;
  } = {},
): Promise<StepRun> {
  const current = await db.query<{ status: StepRunStatus }>(
    'SELECT status FROM step_runs WHERE run_id = $1 AND step_id = $2 FOR UPDATE',
    [runId, stepId],
  );
  if (!current.rows[0]) {
    throw new Error(`Step run not found: run_id=${runId}, step_id=${stepId}`);
  }

  const fromStatus = current.rows[0].status;

  const VALID_TRANSITIONS: Record<StepRunStatus, StepRunStatus[]> = {
    PENDING: ['READY', 'RUNNING', 'SKIPPED'],
    READY: ['RUNNING', 'SKIPPED'],
    RUNNING: ['SUCCEEDED', 'FAILED', 'READY', 'SKIPPED'],
    SUCCEEDED: [],
    FAILED: [],
    SKIPPED: [],
  };

  if (!VALID_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new IllegalStateTransitionError(fromStatus, toStatus);
  }

  const fields: string[] = ['status = $3'];
  const params: unknown[] = [runId, stepId, toStatus];

  if (toStatus === 'RUNNING') {
    fields.push('started_at = COALESCE(started_at, now())');
    fields.push('last_heartbeat_at = now()');
  }

  if (toStatus === 'SUCCEEDED' || toStatus === 'FAILED' || toStatus === 'SKIPPED') {
    fields.push('finished_at = now()');
  }

  if (patch.attempt !== undefined) {
    params.push(patch.attempt);
    fields.push(`attempt = $${params.length}`);
  }

  if (patch.output !== undefined) {
    params.push(patch.output);
    fields.push(`output = $${params.length}`);
  }

  if (patch.error !== undefined) {
    params.push(patch.error);
    fields.push(`error = $${params.length}`);
  }

  const result = await db.query<StepRun>(
    `UPDATE step_runs SET ${fields.join(', ')}
     WHERE run_id = $1 AND step_id = $2
     RETURNING *`,
    params,
  );

  const stepRun = result.rows[0];
  if (!stepRun) {
    throw new Error('Failed to update step run status');
  }
  return stepRun;
}

export async function updateStepRun(
  db: Db | DbClient,
  stepRunId: string,
  patch: {
    status?: StepRunStatus;
    output?: unknown;
    error?: string | null;
    started_at?: Date | null;
    finished_at?: Date | null;
    last_heartbeat_at?: Date | null;
  },
): Promise<StepRun> {
  const sets: string[] = [];
  const params: unknown[] = [stepRunId];

  if (patch.status) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (patch.output !== undefined) {
    params.push(patch.output);
    sets.push(`output = $${params.length}`);
  }
  if (patch.error !== undefined) {
    params.push(patch.error);
    sets.push(`error = $${params.length}`);
  }
  if (patch.started_at !== undefined) {
    params.push(patch.started_at);
    sets.push(`started_at = $${params.length}`);
  }
  if (patch.finished_at !== undefined) {
    params.push(patch.finished_at);
    sets.push(`finished_at = $${params.length}`);
  }
  if (patch.last_heartbeat_at !== undefined) {
    params.push(patch.last_heartbeat_at);
    sets.push(`last_heartbeat_at = $${params.length}`);
  }

  const result = await db.query<StepRun>(
    `UPDATE step_runs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );

  const stepRun = result.rows[0];
  if (!stepRun) {
    throw new Error('Failed to update step run');
  }
  return stepRun;
}

export async function listStepRuns(db: Db | DbClient, tenantId: string, runId: string): Promise<StepRun[]> {
  const result = await db.query<StepRun>(
    `SELECT * FROM step_runs
     WHERE tenant_id = $1 AND run_id = $2
     ORDER BY COALESCE(started_at, '1970-01-01') ASC, step_id ASC`,
    [tenantId, runId],
  );
  return result.rows;
}
