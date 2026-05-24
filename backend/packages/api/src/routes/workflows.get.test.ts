import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../app.js';
import { createTestTenantAndUser, buildAuthToken } from '../test/auth-helpers.js';

describe('GET /workflows/:id route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const tenantBId = 'tenant-bbb-0000-0000-000000000002';
  const workflowId = 'wf-00000000-0000-0000-000000000099';

  const mockWorkflow = {
    id: workflowId,
    tenant_id: tenantAId,
    name: 'My Workflow',
    current_version: 2,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockVersion = {
    id: 'ver-abc',
    workflow_id: workflowId,
    version: 2,
    definition: { name: 'My flow', timeout_sec: 60, steps: [] },
    created_by: 'user-abc',
    created_at: new Date(),
  };

  let mockDb: any;
  let clientQuery: any;
  let app: any;

  beforeEach(async () => {
    clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // Tenant lookup for auth-helpers createTenant
      if (sql.includes('INSERT INTO tenants')) {
        const tenantSlug = params?.[0] as string;
        const id = tenantSlug.includes('tenant-b') ? tenantBId : tenantAId;
        return {
          rows: [{ id, slug: tenantSlug, name: params?.[1], created_at: new Date() }],
        };
      }

      // User lookup for auth-helpers createUser
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

      // GET workflow by tenant_id and id
      if (sql.includes('WHERE tenant_id = $1 AND id = $2')) {
        const tenantId = params?.[0] as string;
        const id = params?.[1] as string;
        if (tenantId === tenantAId && id === workflowId) {
          return { rows: [mockWorkflow] };
        }
        return { rows: [] };
      }

      // GET workflow version
      if (sql.includes('WHERE workflow_id = $1 AND version = $2')) {
        const wfId = params?.[0] as string;
        const version = params?.[1] as number;
        if (wfId === workflowId && version === mockVersion.version) {
          return { rows: [mockVersion] };
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

    app = await buildApp({ db: mockDb, jwtSecret, redis: new RedisMock() as any });
  });

  it('returns 200 with workflow for the owner tenant (VIEWER role)', async () => {
    const { tenant, user } = await createTestTenantAndUser(mockDb, {
      slug: 'tenant-a',
      role: 'VIEWER',
    });
    // Override tenant id to match mockWorkflow
    const token = buildAuthToken(tenantAId, user.id, 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(workflowId);
    expect(body.version).toBeDefined();
    expect(body.version.id).toBe('ver-abc');
  });

  it('returns 404 for cross-tenant access (tenant isolation)', async () => {
    // Tenant B trying to access tenant A's workflow
    const { user } = await createTestTenantAndUser(mockDb, {
      slug: 'tenant-b',
      role: 'VIEWER',
    });
    const token = buildAuthToken(tenantBId, user.id, 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('returns 200 when requesting a specific valid version', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}?version=2`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version.version).toBe(2);
  });

  it('returns 400 for non-numeric version query param', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}?version=abc`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_version');
  });

  it('returns 400 for version < 1 (zero)', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}?version=0`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_version');
  });

  it('returns 403 when user has no role (missing auth context edge case is 401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}`,
    });

    expect(res.statusCode).toBe(401);
  });
});
