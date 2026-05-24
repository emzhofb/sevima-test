import type { Db, StepRun, StepRunStatus } from '@flowforge/shared';

export async function createStepRun(
  db: Db,
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

export async function updateStepRun(
  db: Db,
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
