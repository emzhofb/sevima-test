process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://flowforge:flowforge@localhost:5432/flowforge';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(32);

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import RedisMock from 'ioredis-mock';
import { buildAuthToken } from '../test/auth-helpers.js';
import { loadConfig } from '@flowforge/shared';

const mockCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('AI Generation API', () => {
  const jwtSecret = 'test-secret-at-least-32-characters-long';
  const tenantId = 'tenant-aaa-0000-0000-000000000001';
  let mockDb: any;
  let app: any;
  let redis: any;

  beforeEach(async () => {
    mockCreate.mockReset();
    vi.restoreAllMocks();
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    redis = new RedisMock();
    await redis.flushall();
    app = await buildApp({ db: mockDb, jwtSecret, redis });
  });

  it('returns 404 if AI_ENABLED is false', async () => {
    process.env.AI_ENABLED = 'false';

    const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
    const res = await app.inject({
      method: 'POST',
      url: '/ai/generate-workflow',
      headers: { authorization: `Bearer ${token}` },
      payload: { prompt: 'generate something' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
  });

  describe('when AI_ENABLED is true', () => {
    beforeEach(() => {
      process.env.AI_ENABLED = 'true';
    });

    it('requires EDITOR role', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'VIEWER', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate something' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 400 for invalid/empty input', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid_input' });
    });

    it('returns 413 if prompt is too large', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'a'.repeat(16001) },
      });

      expect(res.statusCode).toBe(413);
      expect(res.json()).toEqual({ error: 'prompt_too_large' });
    });

    it('returns 429 if budget is exceeded', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
      const today = new Date().toISOString().slice(0, 10);
      await redis.set(`ai-budget:${tenantId}:${today}`, '98000');

      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate something' },
      });

      expect(res.statusCode).toBe(429);
      expect(res.json().error).toBe('budget_exceeded');
    });

    it('returns 200 with workflow draft on successful LLM generation', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
      const validWorkflow = {
        name: 'AI Workflow',
        timeout_sec: 60,
        steps: [
          {
            id: 'step1',
            type: 'DELAY',
            depends_on: [],
            config: { duration_ms: 1000 },
            continue_on_failure: false,
          },
        ],
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'AI Workflow',
                timeout_sec: 60,
                steps: [
                  {
                    id: 'step1',
                    type: 'DELAY',
                    depends_on: [],
                    config: { duration_ms: 1000 },
                  },
                ],
              }),
            },
          },
        ],
        usage: { total_tokens: 150 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate delay workflow' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().draft).toEqual(validWorkflow);
    });

    it('rejects generated workflow containing SCRIPT steps', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
      const invalidWorkflow = {
        name: 'Malicious Workflow',
        timeout_sec: 60,
        steps: [
          {
            id: 'step1',
            type: 'SCRIPT',
            depends_on: [],
            config: { code: 'console.log("hello")' },
          },
        ],
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(invalidWorkflow),
            },
          },
        ],
        usage: { total_tokens: 150 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate script workflow' },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error).toBe('script_step_rejected');
    });

    it('re-prompts once and returns workflow if first attempt is invalid but second is valid', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);
      const validWorkflow = {
        name: 'AI Workflow',
        timeout_sec: 60,
        steps: [
          {
            id: 'step1',
            type: 'DELAY',
            depends_on: [],
            config: { duration_ms: 1000 },
            continue_on_failure: false,
          },
        ],
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'invalid-json-response',
            },
          },
        ],
        usage: { total_tokens: 100 },
      });

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'AI Workflow',
                timeout_sec: 60,
                steps: [
                  {
                    id: 'step1',
                    type: 'DELAY',
                    depends_on: [],
                    config: { duration_ms: 1000 },
                  },
                ],
              }),
            },
          },
        ],
        usage: { total_tokens: 120 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate workflow' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().draft).toEqual(validWorkflow);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('returns 422 if re-prompt output still fails validation', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'invalid-json-response',
            },
          },
        ],
        usage: { total_tokens: 100 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate workflow' },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error).toBe('invalid_generation');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('returns 504 on LLM timeout', async () => {
      const token = buildAuthToken(tenantId, 'user-1', 'EDITOR', jwtSecret);

      vi.useFakeTimers();
      const promise = app.inject({
        method: 'POST',
        url: '/ai/generate-workflow',
        headers: { authorization: `Bearer ${token}` },
        payload: { prompt: 'generate workflow' },
      });

      mockCreate.mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 40000));
      });

      await vi.advanceTimersByTimeAsync(35000);

      const res = await promise;
      expect(res.statusCode).toBe(504);
      expect(res.json().error).toBe('llm_timeout');
      vi.useRealTimers();
    });
  });
});
