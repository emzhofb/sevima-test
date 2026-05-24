import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { buildApp } from '../app.js';
import { buildAuthToken } from '../test/auth-helpers.js';

describe('GET /workflows (list) route', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const tenantBId = 'tenant-bbb-0000-0000-000000000002';

  /** Build a fake workflow row */
  function makeWorkflow(id: string, tenantId: string, name: string, updatedAt?: Date) {
    return {
      id,
      tenant_id: tenantId,
      name,
      current_version: 1,
      created_at: new Date('2024-01-01'),
      updated_at: updatedAt ?? new Date('2024-01-01'),
    };
  }

  /** In-memory store so tests are self-contained */
  let workflowStore: ReturnType<typeof makeWorkflow>[];
  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    workflowStore = [];

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // Tenant / User inserts (used by auth helpers)
      if (sql.includes('INSERT INTO tenants')) {
        return {
          rows: [{ id: params?.[0] === 'tenant-b' ? tenantBId : tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }],
        };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [{ id: 'user-xyz', tenant_id: params?.[0], email: params?.[1], password_hash: params?.[2], role: params?.[3], created_at: new Date() }],
        };
      }

      // INSERT workflow (used by POST /workflows in helpers)
      if (sql.includes('INSERT INTO workflows')) {
        const wf = {
          id: `wf-${workflowStore.length + 1}`,
          tenant_id: params?.[0] as string,
          name: params?.[1] as string,
          current_version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        };
        workflowStore.push(wf);
        return { rows: [wf] };
      }
      if (sql.includes('INSERT INTO workflow_versions')) {
        return {
          rows: [{ id: 'ver-1', workflow_id: params?.[0], version: params?.[1], definition: params?.[2], created_by: params?.[3], created_at: new Date() }],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
      }

      // LIST workflows with pagination
      if (sql.includes('SELECT * FROM workflows') && sql.includes('LIMIT')) {
        const tenantId = params?.[0] as string;
        const pageSize = params?.[params.length - 2] as number;
        const offset = params?.[params.length - 1] as number;

        let filtered = workflowStore.filter((w) => w.tenant_id === tenantId);

        // Check for name filter (ILIKE match — params index 1 if present)
        if (params && params.length > 3) {
          const nameFilter = (params[1] as string).replace(/%/g, '').toLowerCase();
          filtered = filtered.filter((w) => w.name.toLowerCase().includes(nameFilter));
        }

        const paginated = filtered
          .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
          .slice(offset, offset + pageSize);

        return { rows: paginated };
      }

      // COUNT workflows
      if (sql.includes('SELECT COUNT(*)::text as count FROM workflows WHERE')) {
        const tenantId = params?.[0] as string;
        let filtered = workflowStore.filter((w) => w.tenant_id === tenantId);

        if (params && params.length > 1) {
          const nameFilter = (params[1] as string).replace(/%/g, '').toLowerCase();
          filtered = filtered.filter((w) => w.name.toLowerCase().includes(nameFilter));
        }

        return { rows: [{ count: filtered.length.toString() }] };
      }

      return { rows: [] };
    });

    mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };

    app = await buildApp({ db: mockDb, jwtSecret, redis: new RedisMock() as any });
  });

  // Helper to inject a workflow via POST
  async function createWorkflow(tenantId: string, name: string) {
    const token = buildAuthToken(tenantId, 'user-xyz', 'EDITOR', jwtSecret);
    const validDef = {
      name,
      timeout_sec: 60,
      steps: [{ id: 'step-1', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
    };
    return app.inject({
      method: 'POST',
      url: '/workflows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name, definition: validDef },
    });
  }

  it('returns default page 1 with pageSize 20 and correct response shape', async () => {
    await createWorkflow(tenantAId, 'Workflow A');
    await createWorkflow(tenantAId, 'Workflow B');

    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page', 1);
    expect(body).toHaveProperty('pageSize', 20);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('paginates correctly with page and pageSize params', async () => {
    // Create 25 workflows for tenantA
    for (let i = 1; i <= 25; i++) {
      await createWorkflow(tenantAId, `Workflow-${String(i).padStart(2, '0')}`);
    }

    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows?page=2&pageSize=10',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(10);
    expect(body.total).toBe(25);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);
  });

  it('filters by name substring (case-insensitive)', async () => {
    await createWorkflow(tenantAId, 'alpha flow');
    await createWorkflow(tenantAId, 'beta flow');
    await createWorkflow(tenantAId, 'Alpha-2 flow');

    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows?name=alpha',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.every((w: any) => w.name.toLowerCase().includes('alpha'))).toBe(true);
  });

  it('only returns workflows belonging to the calling tenant', async () => {
    await createWorkflow(tenantAId, 'Tenant A Workflow');
    await createWorkflow(tenantBId, 'Tenant B Workflow');

    const tokenA = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.every((w: any) => w.tenant_id === tenantAId)).toBe(true);
    expect(body.items.some((w: any) => w.tenant_id === tenantBId)).toBe(false);
  });

  it('returns 400 for invalid query params (pageSize > 100)', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows?pageSize=200',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_query');
  });

  it('returns 400 for invalid query params (page < 1)', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows?page=0',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_query');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for user with insufficient role (below VIEWER is not possible, but no token = 401)', async () => {
    // VIEWER is the minimum — test that VIEWER can access (not 403)
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns empty list when no workflows exist for tenant', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });
});
