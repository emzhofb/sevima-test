import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../app.js';
import { buildAuthToken } from '../test/auth-helpers.js';

describe('POST /workflows/:id/rollback route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const tenantBId = 'tenant-bbb-0000-0000-000000000002';
  const workflowId = 'wf-00000000-0000-0000-000000000099';

  const defV1 = {
    name: 'Flow V1',
    timeout_sec: 60,
    steps: [{ id: 'step-1', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
  };

  /** In-memory state */
  let workflowState: {
    id: string;
    tenant_id: string;
    name: string;
    current_version: number;
    created_at: Date;
    updated_at: Date;
  }[];
  let versionState: {
    id: string;
    workflow_id: string;
    version: number;
    definition: unknown;
    created_by: string;
    created_at: Date;
  }[];

  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    workflowState = [
      {
        id: workflowId,
        tenant_id: tenantAId,
        name: 'My Workflow',
        current_version: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    versionState = [
      {
        id: 'ver-001',
        workflow_id: workflowId,
        version: 1,
        definition: defV1,
        created_by: 'user-xyz',
        created_at: new Date(),
      },
      {
        id: 'ver-002',
        workflow_id: workflowId,
        version: 2,
        definition: { ...defV1, name: 'Flow V2' },
        created_by: 'user-xyz',
        created_at: new Date(),
      },
    ];

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO tenants')) {
        return { rows: [{ id: tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }] };
      }
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-xyz', tenant_id: params?.[0], email: params?.[1], password_hash: params?.[2], role: params?.[3], created_at: new Date() }] };
      }

      // Check if workflow exists (and optionally lock it)
      if (sql.includes('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2')) {
        const tenantId = params?.[0] as string;
        const id = params?.[1] as string;
        const wf = workflowState.find((w) => w.tenant_id === tenantId && w.id === id);
        return { rows: wf ? [wf] : [] };
      }

      // Check if target version exists
      if (sql.includes('SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2')) {
        const wfId = params?.[0] as string;
        const ver = params?.[1] as number;
        const found = versionState.find((v) => v.workflow_id === wfId && v.version === ver);
        return { rows: found ? [found] : [] };
      }

      // Update workflow current_version
      if (sql.includes('UPDATE workflows') && sql.includes('current_version = current_version + 1')) {
        // rollback passes only [workflowId]
        const id = params?.[0] as string;
        const wf = workflowState.find((w) => w.id === id);
        if (!wf) return { rows: [] };
        wf.current_version += 1;
        wf.updated_at = new Date();
        return { rows: [{ ...wf }] };
      }

      // Insert new version
      if (sql.includes('INSERT INTO workflow_versions')) {
        const newVer = {
          id: `ver-00${versionState.length + 1}`,
          workflow_id: params?.[0] as string,
          version: params?.[1] as number,
          definition: params?.[2] as unknown,
          created_by: params?.[3] as string,
          created_at: new Date(),
        };
        versionState.push(newVer);
        return { rows: [newVer] };
      }

      if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
      }

      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => {
        const client = {
          query: clientQuery,
          release: vi.fn(),
        };
        return client;
      }),
    };

    app = await buildApp({ db: mockDb, jwtSecret, redis: new RedisMock() as any });
  });

  it('returns 200 and rolls back to target version', async () => {
    const token = buildAuthToken(tenantAId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/rollback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetVersion: 1 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(workflowId);
    expect(body.current_version).toBe(3);
    // Version 3 should contain definition from version 1
    expect(body.version.version).toBe(3);
    expect(body.version.definition).toMatchObject({ name: 'Flow V1' });
  });

  it('returns 400 for missing targetVersion in body', async () => {
    const token = buildAuthToken(tenantAId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/rollback`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_input');
  });

  it('returns 400 for invalid targetVersion (non-existent version)', async () => {
    const token = buildAuthToken(tenantAId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/rollback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetVersion: 99 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_target_version');
  });

  it('returns 404 for cross-tenant access', async () => {
    const tokenB = buildAuthToken(tenantBId, 'user-admin', 'ADMIN', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/rollback`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { targetVersion: 1 },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('returns 403 for EDITOR role (requires ADMIN)', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/rollback`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetVersion: 1 },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/workflows/${workflowId}/rollback`,
      payload: { targetVersion: 1 },
    });

    expect(res.statusCode).toBe(401);
  });
});
