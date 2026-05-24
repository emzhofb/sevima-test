import { describe, expect, it, vi } from 'vitest';

import {
  createWorkflow,
  deleteWorkflow,
  getWorkflowById,
  listWorkflows,
  rollbackWorkflow,
  updateWorkflow,
} from './workflow.repo.js';

describe('workflow.repo', () => {
  it('creates workflows atomically and supports rollback behavior', async () => {
    const workflowId = '550e8400-e29b-41d4-a716-446655440100';
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '550e8400-e29b-41d4-a716-446655440010';
    const definition = { name: 'Flow', timeout_sec: 60, steps: [] } as never;

    const state = {
      current_version: 1,
      workflowRows: [
        {
          id: workflowId,
          tenant_id: tenantId,
          name: 'Flow',
          current_version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      versions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440101',
          workflow_id: workflowId,
          version: 1,
          definition,
          created_by: userId,
          created_at: new Date(),
        },
      ],
    };

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT INTO workflows')) {
        return { rows: [state.workflowRows[0]] };
      }

      if (sql.startsWith('INSERT INTO workflow_versions')) {
        const versionRow = {
          id: `550e8400-e29b-41d4-a716-44665544010${state.versions.length}`,
          workflow_id: workflowId,
          version: params?.[1] as number,
          definition: params?.[2] as never,
          created_by: params?.[3] as string,
          created_at: new Date(),
        };
        state.versions.push(versionRow);
        return { rows: [versionRow] };
      }

      if (sql.startsWith('UPDATE workflows')) {
        state.current_version += 1;
        const existingRow = state.workflowRows[0]!;
        const row = { ...existingRow, current_version: state.current_version };
        state.workflowRows[0] = row;
        return { rows: [row] };
      }

      if (sql.startsWith('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2 FOR UPDATE')) {
        return { rows: [state.workflowRows[0]] };
      }

      if (
        sql.startsWith('SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2')
      ) {
        const version = params?.[1] as number;
        return { rows: state.versions.filter((item) => item.version === version) };
      }

      if (sql.startsWith('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2')) {
        return { rows: state.workflowRows };
      }

      if (sql.startsWith('SELECT COUNT(*)::text as count FROM workflows')) {
        return { rows: [{ count: '1' }] };
      }

      if (sql.startsWith('DELETE FROM workflows')) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    const pool = {
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
      query: clientQuery,
    };

    const created = await createWorkflow(pool as never, {
      tenant_id: tenantId,
      name: 'Flow',
      definition,
      created_by: userId,
    });
    expect(created.current_version).toBe(1);

    const updated = await updateWorkflow(pool as never, tenantId, workflowId, definition, userId);
    expect(updated?.current_version).toBe(2);

    const rolled = await rollbackWorkflow(pool as never, tenantId, workflowId, 1, userId);
    expect(rolled.current_version).toBe(3);

    const found = await getWorkflowById(pool as never, tenantId, workflowId);
    expect(found?.id).toBe(workflowId);

    const list = await listWorkflows(pool as never, tenantId, {
      page: 1,
      pageSize: 20,
      name: 'Flow',
    });
    expect(list.total).toBe(1);

    await deleteWorkflow(pool as never, tenantId, workflowId);
    expect(clientQuery).toHaveBeenCalledWith(
      'DELETE FROM workflows WHERE tenant_id = $1 AND id = $2',
      [tenantId, workflowId],
    );
  });

  it('rejects invalid rollback targets', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2 FOR UPDATE')) {
        return {
          rows: [
            {
              id: 'wf',
              tenant_id: 'tenant',
              name: 'Flow',
              current_version: 1,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }

      return { rows: [] };
    });

    const pool = {
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
      query,
    };

    await expect(rollbackWorkflow(pool as never, 'tenant', 'wf', 99, 'user')).rejects.toThrow(
      'Version 99 not found',
    );
  });
});
