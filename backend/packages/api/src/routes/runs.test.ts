import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import RedisMock from 'ioredis-mock';
import { buildAuthToken } from '../test/auth-helpers.js';
import { IllegalStateTransitionError } from '../repos/run.repo.js';

describe('Runs routes', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  const tenantBId = 'tenant-bbb-0000-0000-000000000002';
  const runId = 'run-11111111-1111-1111-1111-111111111111';

  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO tenants')) {
        return { rows: [{ id: tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }] };
      }
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-xyz', tenant_id: params?.[0], email: params?.[1], password_hash: params?.[2], role: params?.[3], created_at: new Date() }] };
      }

      if (sql.includes('SELECT * FROM runs WHERE tenant_id = $1 AND id = $2')) {
        if (params?.[1] === runId) {
          return {
            rows: [{
              id: runId,
              tenant_id: tenantAId,
              workflow_id: 'wf-1',
              status: 'RUNNING',
            }]
          };
        }
        return { rows: [] };
      }

      if (sql.includes('SELECT * FROM runs WHERE tenant_id = $1')) {
        return {
          rows: [{ id: runId, tenant_id: tenantAId, status: 'RUNNING' }]
        };
      }
      if (sql.includes('SELECT COUNT(*)::text as count FROM runs')) {
        return { rows: [{ count: '1' }] };
      }

      if (sql.includes('SELECT * FROM step_runs')) {
        return {
          rows: [{ id: 'step-run-1', run_id: runId, tenant_id: tenantAId }]
        };
      }

      if (sql.includes('SELECT status FROM runs WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ status: 'RUNNING' }] };
      }

      if (sql.includes('UPDATE runs SET')) {
        return { rows: [{ id: runId, status: params?.[1] }] };
      }

      if (sql.includes('INSERT INTO audit_logs')) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => {
        return {
          query: clientQuery,
          release: vi.fn(),
          queryRaw: clientQuery,
        };
      }),
    };

    app = await buildApp({
      db: mockDb,
      jwtSecret,
      redis: new RedisMock() as any,
    });
  });

  describe('GET /runs', () => {
    it('returns a list of runs', async () => {
      const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

      const res = await app.inject({
        method: 'GET',
        url: '/runs?page=1&pageSize=10',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items).toHaveLength(1);
      expect(data.total).toBe(1);
    });

    it('returns 400 for date range > 30 days', async () => {
      const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

      const res = await app.inject({
        method: 'GET',
        url: '/runs?fromDate=2023-01-01T00:00:00Z&toDate=2023-03-01T00:00:00Z',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('date_range_too_large');
    });
  });

  describe('GET /runs/:id', () => {
    it('returns run details with step_runs', async () => {
      const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

      const res = await app.inject({
        method: 'GET',
        url: `/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.id).toBe(runId);
      expect(data.step_runs).toHaveLength(1);
    });

    it('returns 404 for non-existent run', async () => {
      const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

      const res = await app.inject({
        method: 'GET',
        url: `/runs/run-9999`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /runs/:id/cancel', () => {
    it('cancels a running run', async () => {
      const token = buildAuthToken(tenantAId, 'user-editor', 'EDITOR', jwtSecret);

      const res = await app.inject({
        method: 'POST',
        url: `/runs/${runId}/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('CANCELLED');
    });

    it('requires EDITOR role', async () => {
      const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

      const res = await app.inject({
        method: 'POST',
        url: `/runs/${runId}/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 409 if run is already finished', async () => {
      const token = buildAuthToken(tenantAId, 'user-editor', 'EDITOR', jwtSecret);
      
      // Override mock to throw IllegalStateTransitionError for this test
      app.db.connect = vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT status FROM runs WHERE id = $1 FOR UPDATE')) {
            return { rows: [{ status: 'SUCCEEDED' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      });
      app.db.query = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT * FROM runs WHERE tenant_id = $1 AND id = $2')) {
          return { rows: [{ id: runId, status: 'SUCCEEDED' }] };
        }
        return { rows: [] };
      });

      const res = await app.inject({
        method: 'POST',
        url: `/runs/${runId}/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('cannot_cancel');
    });
  });

  describe('GET /runs/:id/steps', () => {
    it('returns a list of step runs', async () => {
      const token = buildAuthToken(tenantAId, 'user-viewer', 'VIEWER', jwtSecret);

      const res = await app.inject({
        method: 'GET',
        url: `/runs/${runId}/steps`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().items).toHaveLength(1);
    });
  });
});
