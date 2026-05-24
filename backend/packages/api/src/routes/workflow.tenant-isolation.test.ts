import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getWorkflowById,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
} from '../repos/workflow.repo.js';

describe('tenant isolation on workflows', () => {
  let mockDb: any;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let workflowAId: string;
  let workflowBId: string;
  const definition = { name: 'Test Flow', timeout_sec: 60, steps: [] } as never;

  beforeEach(async () => {
    // Setup tenant and user IDs
    tenantAId = '550e8400-e29b-41d4-a716-446655440001';
    tenantBId = '550e8400-e29b-41d4-a716-446655440002';
    userAId = '550e8400-e29b-41d4-a716-446655440011';
    userBId = '550e8400-e29b-41d4-a716-446655440012';
    workflowAId = '550e8400-e29b-41d4-a716-446655440101';
    workflowBId = '550e8400-e29b-41d4-a716-446655440102';

    // State management for the mock database
    const state = {
      workflows: [
        {
          id: workflowAId,
          tenant_id: tenantAId,
          name: 'Workflow A',
          current_version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: workflowBId,
          tenant_id: tenantBId,
          name: 'Workflow B',
          current_version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      versions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440201',
          workflow_id: workflowAId,
          version: 1,
          definition,
          created_by: userAId,
          created_at: new Date(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440202',
          workflow_id: workflowBId,
          version: 1,
          definition,
          created_by: userBId,
          created_at: new Date(),
        },
      ],
    };

    // Create mock database query function
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // CREATE workflow
      if (sql.startsWith('INSERT INTO workflows')) {
        const newWorkflow = {
          id: params?.[2] as string,
          tenant_id: params?.[0] as string,
          name: params?.[1] as string,
          current_version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        };
        state.workflows.push(newWorkflow);
        return { rows: [newWorkflow] };
      }

      // CREATE version
      if (sql.startsWith('INSERT INTO workflow_versions')) {
        const newVersion = {
          id: `550e8400-e29b-41d4-a716-44665544020${state.versions.length}`,
          workflow_id: params?.[0] as string,
          version: params?.[1] as number,
          definition: params?.[2] as never,
          created_by: params?.[3] as string,
          created_at: new Date(),
        };
        state.versions.push(newVersion);
        return { rows: [newVersion] };
      }

      // GET workflow by tenant_id and id
      if (sql.includes('WHERE tenant_id = $1 AND id = $2') && !sql.includes('UPDATE')) {
        const tenantId = params?.[0] as string;
        const workflowId = params?.[1] as string;
        const workflow = state.workflows.find(
          (w) => w.tenant_id === tenantId && w.id === workflowId,
        );
        return { rows: workflow ? [workflow] : [] };
      }

      // GET version
      if (sql.includes('WHERE workflow_id = $1 AND version = $2')) {
        const workflowId = params?.[0] as string;
        const version = params?.[1] as number;
        const ver = state.versions.find(
          (v) => v.workflow_id === workflowId && v.version === version,
        );
        return { rows: ver ? [ver] : [] };
      }

      // LIST workflows by tenant (with dynamic WHERE clause for pagination)
      if (
        sql.includes('SELECT * FROM workflows') &&
        sql.includes('WHERE tenant_id = $1') &&
        sql.includes('LIMIT')
      ) {
        const tenantId = params?.[0] as string;
        const pageSize = params?.[params.length - 2] as number;
        const offset = params?.[params.length - 1] as number;
        const workflows = state.workflows
          .filter((w) => w.tenant_id === tenantId)
          .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
          .slice(offset, offset + pageSize);
        return { rows: workflows };
      }

      // COUNT workflows
      if (sql.includes('SELECT COUNT(*)::text as count FROM workflows WHERE')) {
        const tenantId = params?.[0] as string;
        const count = state.workflows.filter((w) => w.tenant_id === tenantId).length;
        return { rows: [{ count: count.toString() }] };
      }

      // UPDATE workflow
      if (
        sql.includes('UPDATE workflows') &&
        sql.includes('SET current_version = current_version + 1')
      ) {
        const tenantId = params?.[0] as string;
        const workflowId = params?.[1] as string;
        const workflow = state.workflows.find(
          (w) => w.tenant_id === tenantId && w.id === workflowId,
        );
        if (workflow) {
          workflow.current_version += 1;
          workflow.updated_at = new Date();
          return { rows: [workflow] };
        }
        return { rows: [] };
      }

      // DELETE workflow
      if (sql.includes('DELETE FROM workflows WHERE tenant_id = $1 AND id = $2')) {
        const tenantId = params?.[0] as string;
        const workflowId = params?.[1] as string;
        const index = state.workflows.findIndex(
          (w) => w.tenant_id === tenantId && w.id === workflowId,
        );
        if (index > -1) {
          state.workflows.splice(index, 1);
        }
        return { rows: [] };
      }

      return { rows: [] };
    });

    mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({
        query: clientQuery,
        release: vi.fn(),
      })),
    };
  });

  it('list workflows: tenant A sees only A workflows', async () => {
    const result = await listWorkflows(mockDb, tenantAId);
    const ids = result.items.map((w) => w.id);

    expect(ids).toContain(workflowAId);
    expect(ids).not.toContain(workflowBId);
    expect(result.total).toBe(1);
  });

  it('list workflows: tenant B sees only B workflows', async () => {
    const result = await listWorkflows(mockDb, tenantBId);
    const ids = result.items.map((w) => w.id);

    expect(ids).toContain(workflowBId);
    expect(ids).not.toContain(workflowAId);
    expect(result.total).toBe(1);
  });

  it('getById: tenant A on tenant B workflow returns null', async () => {
    const result = await getWorkflowById(mockDb, tenantAId, workflowBId);

    expect(result).toBeNull();
  });

  it('getById: tenant B on tenant A workflow returns null', async () => {
    const result = await getWorkflowById(mockDb, tenantBId, workflowAId);

    expect(result).toBeNull();
  });

  it('update: tenant A on tenant B workflow returns null', async () => {
    const result = await updateWorkflow(mockDb, tenantAId, workflowBId, definition, userAId);

    expect(result).toBeNull();
  });

  it('update: tenant B on tenant A workflow returns null', async () => {
    const result = await updateWorkflow(mockDb, tenantBId, workflowAId, definition, userBId);

    expect(result).toBeNull();
  });

  it('delete: tenant A on tenant B workflow does nothing silently', async () => {
    // Before delete
    const beforeListB = await listWorkflows(mockDb, tenantBId);
    expect(beforeListB.total).toBe(1);

    // Delete as tenant A (should not affect tenant B workflows)
    await deleteWorkflow(mockDb, tenantAId, workflowBId);

    // After delete - workflow B should still exist
    const afterListB = await listWorkflows(mockDb, tenantBId);
    expect(afterListB.total).toBe(1);
    expect(afterListB.items[0]?.id).toBe(workflowBId);
  });

  it('delete: tenant B on tenant A workflow does nothing silently', async () => {
    // Before delete
    const beforeListA = await listWorkflows(mockDb, tenantAId);
    expect(beforeListA.total).toBe(1);

    // Delete as tenant B (should not affect tenant A workflows)
    await deleteWorkflow(mockDb, tenantBId, workflowAId);

    // After delete - workflow A should still exist
    const afterListA = await listWorkflows(mockDb, tenantAId);
    expect(afterListA.total).toBe(1);
    expect(afterListA.items[0]?.id).toBe(workflowAId);
  });
});
