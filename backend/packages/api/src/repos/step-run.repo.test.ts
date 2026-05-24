import { describe, expect, it, vi } from 'vitest';

import { createStepRun, updateStepRun } from './step-run.repo.js';

describe('step-run.repo', () => {
  it('creates and updates step runs with scoped SQL', async () => {
    const stepRun = {
      id: 'step-run-1',
      run_id: 'run-1',
      tenant_id: 'tenant-1',
      step_id: 'step-1',
      status: 'PENDING',
      attempt: 1,
      output: null,
      error: null,
      started_at: null,
      finished_at: null,
      last_heartbeat_at: null,
    };

    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT INTO step_runs')) {
        return { rows: [stepRun] };
      }

      return { rows: [{ ...stepRun, status: 'RUNNING' }] };
    });

    const db = { query };

    const created = await createStepRun(db as never, {
      run_id: 'run-1',
      tenant_id: 'tenant-1',
      step_id: 'step-1',
    });
    const updated = await updateStepRun(db as never, 'step-run-1', { status: 'RUNNING' });

    expect(created.status).toBe('PENDING');
    expect(updated.status).toBe('RUNNING');
    expect(query).toHaveBeenCalledWith(
      `INSERT INTO step_runs (run_id, tenant_id, step_id, attempt, status)
     VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *`,
      ['run-1', 'tenant-1', 'step-1', 1],
    );
    expect(query).toHaveBeenCalledWith(
      'UPDATE step_runs SET status = $2 WHERE id = $1 RETURNING *',
      ['step-run-1', 'RUNNING'],
    );
  });
});
