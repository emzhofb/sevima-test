import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import RedisMock from 'ioredis-mock';
import { buildAuthToken } from '../test/auth-helpers.js';

describe('POST /workflows/:id/runs route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const workflowId = 'wf-00000000-0000-0000-000000000099';
  const versionId = 'ver-00000000-0000-0000-000000000099';

  let mockDb: any;
  let app: any;
  let mockBrokerEnqueue: any;

  beforeEach(async () => {
    mockBrokerEnqueue = vi.fn().mockResolvedValue('12345-0');

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO tenants')) {
        return {
          rows: [{ id: tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }],
        };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [
            {
              id: 'user-xyz',
              tenant_id: params?.[0],
              email: params?.[1],
              password_hash: params?.[2],
              role: params?.[3],
              created_at: new Date(),
            },
          ],
        };
      }

      if (sql.includes('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2')) {
        if (params?.[1] === workflowId) {
          return {
            rows: [
              {
                id: workflowId,
                tenant_id: tenantAId,
                name: 'My Workflow',
                current_version: 1,
              },
            ],
          };
        }
        return { rows: [] };
      }

      if (sql.includes('SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2')) {
        return {
          rows: [
            {
              id: versionId,
              workflow_id: workflowId,
              version: 1,
              definition: {},
            },
          ],
        };
      }

      if (sql.includes('INSERT INTO runs')) {
        return {
          rows: [
            {
              id: 'run-00000000-0000-0000-000000000001',
              tenant_id: params?.[0],
              workflow_id: params?.[1],
              version_id: params?.[2],
              trigger_type: params?.[3],
              input: params?.[4],
              status: 'PENDING',
            },
          ],
        };
      }

      if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };

    app = await buildApp({
      db: mockDb,
      jwtSecret,
      redis: new RedisMock() as any,
    });

    // Override broker
    app.broker.enqueue = mockBrokerEnqueue;
  });

  it('triggers a run and returns 202', async () => {
    const token = buildAuthToken(tenantAId, 'user-editor', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/runs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: { foo: 'bar' } },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().run_id).toBe('run-00000000-0000-0000-000000000001');

    expect(mockBrokerEnqueue).toHaveBeenCalledWith('flowforge:runs', {
      run_id: 'run-00000000-0000-0000-000000000001',
      tenant_id: tenantAId,
    });
  });

  it('viewer role gets 403', async () => {
    const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/runs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: {} },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 if workflow does not exist', async () => {
    const token = buildAuthToken(tenantAId, 'user-editor', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/wf-nonexistent/runs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: {} },
    });

    expect(res.statusCode).toBe(404);
  });
});
