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
  const tenantSlug = 'tenant-slug-1';
  const workflowId = 'wf-111-1111-1111-1111-111111111111';

  let mockDb: any;
  let app: any;

  beforeEach(async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // Webhook receiver lookup
      if (sql.includes('SELECT w.id, w.tenant_id, w.webhook_secret')) {
        return {
          rows: [
            {
              id: workflowId,
              tenant_id: tenantId,
              webhook_secret: 'my-webhook-secret',
              current_version: 1,
              version_id: 'ver-1',
            },
          ],
        };
      }
      // Workflow lookup
      if (sql.includes('FROM workflows WHERE tenant_id') && sql.includes('AND id')) {
        return {
          rows: [
            {
              id: workflowId,
              tenant_id: tenantId,
              current_version: 1,
              webhook_secret: 'my-webhook-secret',
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
      if (sql.includes('INSERT INTO runs')) {
        return { rows: [{ id: 'run-123' }] };
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

  describe('POST /webhooks/:tenant_slug/:workflow_id', () => {
    it('triggers a run for a valid signature and within-window timestamp', async () => {
      const body = { test: true };
      const ts = Math.floor(Date.now() / 1000);
      const signature = computeWebhookSignature('my-webhook-secret', JSON.stringify(body), ts);

      const res = await app.inject({
        method: 'POST',
        url: `/webhooks/${tenantSlug}/${workflowId}`,
        headers: {
          'x-flowforge-signature': signature,
          'x-flowforge-timestamp': String(ts),
        },
        payload: body,
      });

      expect(res.statusCode).toBe(202);
      expect(res.json().run_id).toBe('run-123');
    });

    it('returns 401 if signature or timestamp header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/webhooks/${tenantSlug}/${workflowId}`,
        payload: { test: true },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 if timestamp is expired (more than 5 minutes difference)', async () => {
      const body = { test: true };
      const ts = Math.floor(Date.now() / 1000) - 301; // 5 min 1 sec ago
      const signature = computeWebhookSignature('my-webhook-secret', JSON.stringify(body), ts);

      const res = await app.inject({
        method: 'POST',
        url: `/webhooks/${tenantSlug}/${workflowId}`,
        headers: {
          'x-flowforge-signature': signature,
          'x-flowforge-timestamp': String(ts),
        },
        payload: body,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 if signature does not match', async () => {
      const body = { test: true };
      const ts = Math.floor(Date.now() / 1000);

      const res = await app.inject({
        method: 'POST',
        url: `/webhooks/${tenantSlug}/${workflowId}`,
        headers: {
          'x-flowforge-signature': 'invalid-signature-hex',
          'x-flowforge-timestamp': String(ts),
        },
        payload: body,
      });
      expect(res.statusCode).toBe(401);
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
