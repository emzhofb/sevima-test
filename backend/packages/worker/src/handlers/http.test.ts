import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { executeHttp } from './http.js';

function makeFetchMock(status: number, body: unknown, contentType = 'application/json') {
  const responseText = typeof body === 'string' ? body : JSON.stringify(body);
  return vi.fn().mockResolvedValue({
    status,
    text: vi.fn().mockResolvedValue(responseText),
    headers: {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'content-type') return contentType;
        return null;
      }),
      entries: vi.fn().mockReturnValue([['content-type', contentType]]),
    },
  });
}

describe('executeHttp', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns ok with parsed JSON body on 200', async () => {
    global.fetch = makeFetchMock(200, { foo: 'bar' }) as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/data', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).status).toBe(200);
      expect((result.output as any).body).toEqual({ foo: 'bar' });
    }
  });

  it('returns ok with text body for non-JSON response', async () => {
    global.fetch = makeFetchMock(200, 'hello world', 'text/plain') as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/text', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).body).toBe('hello world');
    }
  });

  it('returns ok for 4xx responses (not server errors)', async () => {
    global.fetch = makeFetchMock(404, 'Not Found', 'text/plain') as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/notfound', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).status).toBe(404);
    }
  });

  it('returns error on 500', async () => {
    global.fetch = makeFetchMock(500, 'Internal Server Error', 'text/plain') as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/data', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('HTTP 500');
    }
  });

  it('returns error on 503', async () => {
    global.fetch = makeFetchMock(503, '', 'text/plain') as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/health', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('HTTP 503');
    }
  });

  it('sends POST request with correct method', async () => {
    const mockFetch = makeFetchMock(201, { id: '123' });
    global.fetch = mockFetch as any;

    const result = await executeHttp(
      {
        config: {
          url: 'https://api.example.com/create',
          method: 'POST',
          body: { name: 'test' },
          headers: { 'content-type': 'application/json' },
        },
        timeout_sec: 5,
      },
      'run-1',
      null,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).status).toBe(201);
    }
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/create',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/data', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Network error');
    }
  });

  it('returns timeout error when request is aborted', async () => {
    global.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })) as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/slow', method: 'GET' }, timeout_sec: 1 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Timeout');
    }
  });

  it('includes response headers in output', async () => {
    global.fetch = makeFetchMock(200, {}) as any;

    const result = await executeHttp(
      { config: { url: 'https://api.example.com/data', method: 'GET' }, timeout_sec: 5 },
      'run-1',
      null,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).headers).toBeDefined();
    }
  });
});
