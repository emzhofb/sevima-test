import { describe, expect, it, vi } from 'vitest';

import { IllegalStateTransitionError, createRun, transitionRunStatus } from './run.repo.js';

describe('run.repo', () => {
  it('rejects illegal terminal to running transitions', async () => {
    const state = { status: 'SUCCEEDED' as const };

    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT INTO runs')) {
        return {
          rows: [
            {
              id: 'run-1',
              tenant_id: 'tenant-1',
              workflow_id: 'wf-1',
              version_id: 'ver-1',
              status: 'PENDING',
              input: {},
              trigger_type: 'MANUAL',
              started_at: null,
              finished_at: null,
              created_at: new Date(),
            },
          ],
        };
      }

      if (sql.startsWith('SELECT status FROM runs WHERE id = $1 FOR UPDATE')) {
        return { rows: [state] };
      }

      if (sql.startsWith('UPDATE runs SET')) {
        state.status = params?.[1] as never;
        return {
          rows: [
            {
              id: 'run-1',
              tenant_id: 'tenant-1',
              workflow_id: 'wf-1',
              version_id: 'ver-1',
              status: params?.[1],
              input: {},
              trigger_type: 'MANUAL',
              started_at: null,
              finished_at: null,
              created_at: new Date(),
            },
          ],
        };
      }

      return { rows: [] };
    });

    const db = {
      query,
      connect: vi.fn(),
    };

    const run = await createRun(db as never, {
      tenant_id: 'tenant-1',
      workflow_id: 'wf-1',
      version_id: 'ver-1',
      trigger_type: 'MANUAL',
      input: {},
    });
    expect(run.status).toBe('PENDING');

    await expect(transitionRunStatus(db as never, 'run-1', 'RUNNING')).rejects.toBeInstanceOf(
      IllegalStateTransitionError,
    );
  });
});
