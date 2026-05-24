import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import RedisMock from 'ioredis-mock';
import { buildAuthToken } from '../test/auth-helpers.js';

// Mock cron-parser for tests
vi.mock('cron-parser', () => ({
  default: {
    parseExpression: vi.fn().mockReturnValue({
      next: () => ({ toDate: () => new Date('2099-01-01T00:05:00Z') }),
    }),
  },
}));

describe('Schedule routes', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantId = 'tenant-aaa-0000-0000-000000000001';
  const workflowId = 'wf-111-1111-1111-1111-111111111111';
  const scheduleId = 'sched-1';

  let mockDb: any;
  let app: any;

  const mockSchedule = {
    id: scheduleId,
    tenant_id: tenantId,
    workflow_id: workflowId,
    cron_expr: '*/5 * * * *',
    tz: 'UTC',
    next_run_at: new Date('2099-01-01T00:00:00Z'),
    enabled: true,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // Workflow lookup
      if (sql.includes('FROM workflows WHERE tenant_id') && sql.includes('AND id')) {
        return { rows: [{ id: workflowId, tenant_id: tenantId, current_version: 1 }] };
      }
      if (sql.includes('FROM workflow_versions')) {
        return {
          rows: [{ id: 'ver-1', workflow_id: workflowId, version: 1, definition: { steps: [] } }],
        };
      }
      // Schedule CRUD
      if (sql.includes('INSERT INTO schedules')) {
        return { rows: [mockSchedule] };
      }
      if (sql.includes('FROM schedules WHERE tenant_id = $1 AND workflow_id')) {
        return { rows: [mockSchedule] };
      }
      if (sql.includes('SELECT * FROM schedules WHERE tenant_id = $1 AND id = $2')) {
        return params?.[1] === scheduleId ? { rows: [mockSchedule] } : { rows: [] };
      }
      if (sql.includes('UPDATE schedules SET')) {
        return { rows: [{ ...mockSchedule, enabled: false }] };
      }
      if (sql.includes('DELETE FROM schedules')) {
        return { rows: [], rowCount: params?.[1] === scheduleId ? 1 : 0 };
      }
      // Audit/other
      if (
        sql.includes('INSERT INTO tenants') ||
        sql.includes('INSERT INTO users') ||
        sql.includes('INSERT INTO audit_logs')
      ) {
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

  describe('POST /workflows/:id/schedules', () => {
    it('creates a schedule and returns 201', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: `/workflows/${workflowId}/schedules`,
        headers: { authorization: `Bearer ${token}` },
        payload: { cron_expr: '*/5 * * * *', tz: 'UTC', enabled: true },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe(scheduleId);
    });

    it('requires EDITOR role', async () => {
      const token = buildAuthToken(tenantId, 'user-viewer', 'VIEWER', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: `/workflows/${workflowId}/schedules`,
        headers: { authorization: `Bearer ${token}` },
        payload: { cron_expr: '*/5 * * * *' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for missing cron_expr', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: `/workflows/${workflowId}/schedules`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /workflows/:id/schedules', () => {
    it('returns list of schedules', async () => {
      const token = buildAuthToken(tenantId, 'user-viewer', 'VIEWER', jwtSecret);
      const res = await app.inject({
        method: 'GET',
        url: `/workflows/${workflowId}/schedules`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toHaveLength(1);
    });
  });

  describe('PATCH /schedules/:id', () => {
    it('updates enabled field', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'PATCH',
        url: `/schedules/${scheduleId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().enabled).toBe(false);
    });

    it('returns 404 for unknown schedule', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'PATCH',
        url: `/schedules/nonexistent`,
        headers: { authorization: `Bearer ${token}` },
        payload: { enabled: false },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /schedules/:id', () => {
    it('deletes schedule and returns 204', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'DELETE',
        url: `/schedules/${scheduleId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 when schedule not found', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'DELETE',
        url: `/schedules/nonexistent`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
