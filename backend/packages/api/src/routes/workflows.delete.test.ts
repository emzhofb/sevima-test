import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../app.js';
import { buildAuthToken } from '../test/auth-helpers.js';

describe('DELETE /workflows/:id route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const tenantBId = 'tenant-bbb-0000-0000-000000000002';
  const workflowId = 'wf-00000000-0000-0000-000000000099';

  /** In-memory state: workflows */
  let workflowState: {
    id: string;
    tenant_id: string;
    name: string;
  }[];

  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    workflowState = [
      {
        id: workflowId,
        tenant_id: tenantAId,
        name: 'My Workflow',
      },
    ];

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // INSERT tenant
      if (sql.includes('INSERT INTO tenants')) {
        return {
          rows: [{ id: tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }],
        };
      }
      // INSERT user
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

      // DELETE workflow
      if (sql.includes('DELETE FROM workflows WHERE tenant_id = $1 AND id = $2')) {
        const tenantId = params?.[0] as string;
        const id = params?.[1] as string;

        const idx = workflowState.findIndex((w) => w.tenant_id === tenantId && w.id === id);
        if (idx !== -1) {
          workflowState.splice(idx, 1);
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }

      // INSERT audit_logs
      if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };

    app = await buildApp({ db: mockDb, jwtSecret, redis: new RedisMock() as any });
  });

  it('returns 204 No Content when successfully deleted', async () => {
    const token = buildAuthToken(tenantAId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'DELETE',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);
    expect(workflowState).toHaveLength(0);
  });

  it('returns 404 if workflow does not exist', async () => {
    const token = buildAuthToken(tenantAId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'DELETE',
      url: `/workflows/wf-nonexistent`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('returns 404 for cross-tenant access', async () => {
    const token = buildAuthToken(tenantBId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'DELETE',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 for EDITOR role (requires ADMIN)', async () => {
    const token = buildAuthToken(tenantAId, 'user-editor', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'DELETE',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/workflows/${workflowId}`,
    });

    expect(res.statusCode).toBe(401);
  });
});
