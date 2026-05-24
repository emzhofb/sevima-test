import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import RedisMock from 'ioredis-mock';
import { buildAuthToken } from '../test/auth-helpers.js';

describe('Rate Limiting', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantAId = 'tenant-aaa-0000-0000-000000000001';
  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // Basic mock just to satisfy auth and routes
      if (sql.includes('INSERT INTO tenants')) {
        return { rows: [{ id: tenantAId, slug: params?.[0], name: params?.[1], created_at: new Date() }] };
      }
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-xyz', tenant_id: params?.[0], email: params?.[1], password_hash: params?.[2], role: params?.[3], created_at: new Date() }] };
      }
      if (sql.includes('SELECT * FROM workflows')) {
        // Just return empty items for GET /workflows
        return { rows: [] };
      }
      if (sql.includes('SELECT COUNT(*)')) {
        return { rows: [{ count: '0' }] };
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
      rateLimitConfig: { limit: 5, windowSec: 60 },
    });
  });

  it('returns 429 when rate limited', async () => {
    const token = buildAuthToken(tenantAId, 'user-xyz', 'VIEWER', jwtSecret);

    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/workflows',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    }

    // The 6th request should be rate limited
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${token}` },
    });
    
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
