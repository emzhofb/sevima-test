import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import RedisMock from 'ioredis-mock';
import { buildAuthToken } from '../test/auth-helpers.js';
import {
  rotateWebhookSecret,
  computeWebhookSignature,
  verifyWebhookSignature,
  verifyWebhookSignatureHmac,
} from '../repos/webhook.repo.js';

describe('Webhook secret management', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantId = 'tenant-aaa-0000-0000-000000000001';
  const workflowId = 'wf-111-1111-1111-1111-111111111111';

  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // Workflow lookup
      if (sql.includes('FROM workflows WHERE tenant_id') && sql.includes('AND id')) {
        return {
          rows: [
            {
              id: workflowId,
              tenant_id: tenantId,
              current_version: 1,
              webhook_secret_hash: 'hashed',
            },
          ],
        };
      }
      if (sql.includes('FROM workflow_versions')) {
        return {
          rows: [{ id: 'ver-1', workflow_id: workflowId, version: 1, definition: { steps: [] } }],
        };
      }
      if (sql.includes('UPDATE workflows SET webhook_secret_hash')) {
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

  describe('POST /workflows/:id/webhook/rotate-secret', () => {
    it('rotates secret and returns 200 with new secret', async () => {
      const token = buildAuthToken(tenantId, 'user-admin', 'ADMIN', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: `/workflows/${workflowId}/webhook/rotate-secret`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().secret).toBeDefined();
      expect(typeof res.json().secret).toBe('string');
    });

    it('requires ADMIN role', async () => {
      const token = buildAuthToken(tenantId, 'user-editor', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: `/workflows/${workflowId}/webhook/rotate-secret`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for unknown workflow', async () => {
      const token = buildAuthToken(tenantId, 'user-admin', 'ADMIN', jwtSecret);
      // Change mock to return nothing for workflow query
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });
      const res = await app.inject({
        method: 'POST',
        url: `/workflows/nonexistent/webhook/rotate-secret`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('webhook signature helpers', () => {
    it('computes and verifies HMAC signature', () => {
      const secret = 'my-secret';
      const body = '{"event": "test"}';
      const ts = 1234567890;
      const expected = computeWebhookSignature(secret, body, ts);
      const verified = verifyWebhookSignatureHmac(expected, expected);
      expect(verified).toBe(true);

      const verifiedWrong = verifyWebhookSignatureHmac(expected, 'wrong-sig');
      expect(verifiedWrong).toBe(false);
    });
  });
});
