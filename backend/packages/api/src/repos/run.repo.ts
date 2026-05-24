import type { Db, DbClient, Run, RunStatus, TriggerType } from '@flowforge/shared';

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
    this.name = 'IllegalStateTransitionError';
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
  const result = await db.query<Run>(
    `INSERT INTO runs (tenant_id, workflow_id, version_id, trigger_type, input, status)
     VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING *`,
    [input.tenant_id, input.workflow_id, input.version_id, input.trigger_type, input.input],
  );

  const run = result.rows[0];
  if (!run) {
    throw new Error('Failed to create run');
  }
  return run;
}

export async function transitionRunStatus(
  db: DbClient,
  runId: string,
  toStatus: RunStatus,
): Promise<Run> {
  const current = await db.query<{ status: RunStatus }>(
    'SELECT status FROM runs WHERE id = $1 FOR UPDATE',
    [runId],
  );
  if (!current.rows[0]) {
    throw new Error('Run not found');
  }

  const fromStatus = current.rows[0].status;
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

  const result = await db.query<Run>(
    `UPDATE runs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  );
  const run = result.rows[0];
  if (!run) {
    throw new Error('Failed to update run status');
  }
  return run;
}

export type { Run, RunStatus, TriggerType } from '@flowforge/shared';
