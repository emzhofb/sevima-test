import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../app.js';
import { createTestTenantAndUser, buildAuthToken } from '../test/auth-helpers.js';

describe('workflows.create route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  let mockDb: any;
  let clientQuery: any;
  let app: any;

  beforeEach(async () => {
    clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO tenants')) {
        return {
          rows: [
            {
              id: 'tenant-123',
              slug: params?.[0],
              name: params?.[1],
              created_at: new Date(),
            },
          ],
        };
      }

      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [
            {
              id: 'user-456',
              tenant_id: params?.[0],
              email: params?.[1],
              password_hash: params?.[2],
              role: params?.[3],
              created_at: new Date(),
            },
          ],
        };
      }

      if (sql.includes('INSERT INTO workflows')) {
        return {
          rows: [
            {
              id: 'wf-789',
              tenant_id: params?.[0],
              name: params?.[1],
              current_version: 1,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }

      if (sql.includes('INSERT INTO workflow_versions')) {
        return {
          rows: [
            {
              id: 'ver-abc',
              workflow_id: params?.[0],
              version: params?.[1],
              definition: params?.[2],
              created_by: params?.[3],
              created_at: new Date(),
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
      connect: vi.fn(async () => ({
        query: clientQuery,
        release: vi.fn(),
      })),
    };

    app = await buildApp({
      db: mockDb,
      jwtSecret,
      redis: new RedisMock() as any,
    });
  });

  it('creates workflow with valid definition and returns 201', async () => {
    const { tenant, user } = await createTestTenantAndUser(mockDb, { role: 'EDITOR' });
    const token = buildAuthToken(tenant.id, user.id, 'EDITOR', jwtSecret);

    const validDef = {
      name: 'My flow',
      timeout_sec: 60,
      steps: [
        {
          id: 'step-1',
          type: 'DELAY',
          depends_on: [],
          config: { duration_ms: 1000 },
        },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/workflows',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'Test Workflow',
        definition: validDef,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe('wf-789');
    expect(body.name).toBe('Test Workflow');
    expect(body.version).toBeDefined();
    expect(body.version.id).toBe('ver-abc');
  });

  it('rejects invalid definition (cycle) with 400', async () => {
    const { tenant, user } = await createTestTenantAndUser(mockDb, { role: 'EDITOR' });
    const token = buildAuthToken(tenant.id, user.id, 'EDITOR', jwtSecret);

    // Cyclic dependencies
    const invalidDef = {
      name: 'Cyclic flow',
      timeout_sec: 60,
      steps: [
        {
          id: 'step-1',
          type: 'DELAY',
          depends_on: ['step-2'],
          config: { duration_ms: 1000 },
        },
        {
          id: 'step-2',
          type: 'DELAY',
          depends_on: ['step-1'],
          config: { duration_ms: 1000 },
        },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/workflows',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'Cyclic Workflow',
        definition: invalidDef,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('invalid_definition');
    expect(body.errors).toBeDefined();
  });

  it('rejects request with VIEWER role with 403', async () => {
    const { tenant, user } = await createTestTenantAndUser(mockDb, { role: 'VIEWER' });
    const token = buildAuthToken(tenant.id, user.id, 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: '/workflows',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'Test Workflow',
        definition: {
          name: 'My flow',
          timeout_sec: 60,
          steps: [],
        },
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/workflows',
      payload: {
        name: 'Test Workflow',
        definition: {
          name: 'My flow',
          timeout_sec: 60,
          steps: [],
        },
      },
    });

    expect(res.statusCode).toBe(401);
  });
});
