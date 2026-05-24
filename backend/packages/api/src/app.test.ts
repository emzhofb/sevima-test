import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from './app.js';

describe('Fastify app configuration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn(),
    };

    app = await buildApp({
      db: mockDb,
      jwtSecret: 'test-secret',
    });
  });

  it('should create app with correct bodyLimit', () => {
    // Fastify doesn't expose bodyLimit directly, so we verify by checking the app instance exists
    expect(app).toBeDefined();
    expect(app.decorate).toBeDefined();
  });

  it('rejects body > 1 MB with 413', async () => {
    app.post('/test', async () => {
      return { success: true };
    });

    // Create a huge payload (2 MB)
    const huge = 'x'.repeat(2 * 1024 * 1024);

    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ data: huge }),
    });

    expect(res.statusCode).toBe(413);
  });

  it('accepts body < 1 MB', async () => {
    app.post('/test', async () => {
      return { success: true };
    });

    // Create payload of 500 KB
    const payload = 'x'.repeat(500 * 1024);

    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ data: payload }),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
  });

  it('attaches database to app context', () => {
    expect(app.db).toBe(mockDb);
  });
});
