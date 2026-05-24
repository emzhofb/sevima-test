import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../app.js';
import { buildAuthToken } from '../test/auth-helpers.js';

describe('PATCH /workflows/:id route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const tenantBId = 'tenant-bbb-0000-0000-000000000002';
  const workflowId = 'wf-00000000-0000-0000-000000000099';

  const defV1 = {
    name: 'Flow V1',
    timeout_sec: 60,
    steps: [{ id: 'step-1', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
  };

  const defV2 = {
    name: 'Flow V2',
    timeout_sec: 120,
    steps: [{ id: 'step-1', type: 'DELAY', depends_on: [], config: { duration_ms: 200 } }],
  };

  /** In-memory state: workflows + versions */
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
        current_version: 1,
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
    ];

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // INSERT tenant
      if (sql.includes('INSERT INTO tenants')) {
        return { rows: [{ id: tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }] };
      }
      // INSERT user
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-xyz', tenant_id: params?.[0], email: params?.[1], password_hash: params?.[2], role: params?.[3], created_at: new Date() }] };
      }

      // UPDATE workflow (PATCH — increments current_version)
      if (sql.includes('UPDATE workflows') && sql.includes('current_version = current_version + 1')) {
        const tenantId = params?.[0] as string;
        const id = params?.[1] as string;
        const wf = workflowState.find((w) => w.tenant_id === tenantId && w.id === id);
        if (!wf) return { rows: [] };
        wf.current_version += 1;
        wf.updated_at = new Date();
        return { rows: [{ ...wf }] };
      }

      // INSERT workflow_versions (creates new version)
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

      // GET workflow by tenant_id and id
      if (sql.includes('WHERE tenant_id = $1 AND id = $2') && !sql.includes('UPDATE')) {
        const tenantId = params?.[0] as string;
        const id = params?.[1] as string;
        const wf = workflowState.find((w) => w.tenant_id === tenantId && w.id === id);
        return { rows: wf ? [wf] : [] };
      }

      // GET version by workflow_id and version number
      if (sql.includes('WHERE workflow_id = $1 AND version = $2')) {
        const wfId = params?.[0] as string;
        const ver = params?.[1] as number;
        const found = versionState.find((v) => v.workflow_id === wfId && v.version === ver);
        return { rows: found ? [found] : [] };
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

  it('returns 200 and new version number after update', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { definition: defV2 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(workflowId);
    expect(body.current_version).toBe(2);
    expect(body.version.version).toBe(2);
  });

  it('old version is immutable — v1 still retrievable after patch', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'EDITOR', jwtSecret);

    // PATCH creates version 2
    await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { definition: defV2 },
    });

    // Verify v1 still exists
    const v1Res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}?version=1`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(v1Res.statusCode).toBe(200);
    expect(v1Res.json().version.version).toBe(1);
    expect(v1Res.json().version.definition).toMatchObject({ name: 'Flow V1' });

    // Verify current version is now 2
    const currentRes = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(currentRes.statusCode).toBe(200);
    expect(currentRes.json().current_version).toBe(2);
    expect(currentRes.json().version.version).toBe(2);
    expect(currentRes.json().version.definition).toMatchObject({ name: 'Flow V2' });
  });

  it('returns 400 for invalid (cyclic) definition', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'EDITOR', jwtSecret);
    const cyclicDef = {
      name: 'Cyclic',
      timeout_sec: 60,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 100 } },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 } },
      ],
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { definition: cyclicDef },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_definition');
  });

  it('returns 400 for missing definition in body', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_input');
  });

  it('returns 404 for cross-tenant access (tenant isolation)', async () => {
    const tokenB = buildAuthToken(tenantBId, 'user-xyz', 'EDITOR', jwtSecret);

    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { definition: defV2 },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('returns 403 for VIEWER role (requires EDITOR)', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);

    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { definition: defV2 },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowId}`,
      payload: { definition: defV2 },
    });

    expect(res.statusCode).toBe(401);
  });
});
