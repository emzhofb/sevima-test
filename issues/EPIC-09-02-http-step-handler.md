# [Epic-09] HTTP step handler

**Labels**: `epic-09`, `area-worker`
**Estimate**: 1.5 jam
**Depends on**: #71

## Context

Eksekusi HTTP request dengan timeout per-step.

## Acceptance Criteria

- [ ] Function `executeHttp(spec, runId, db)`
- [ ] Pakai built-in `fetch` (Node 20+)
- [ ] Timeout default 30 detik (override via `spec.timeout_sec`)
- [ ] Output: `{ status, headers, body }`
- [ ] Failure jika status >= 500 atau network error
- [ ] Test dengan `nock` atau MSW

## Implementation Hints

```ts
// packages/worker/src/handlers/http.ts
type StepOutcome = { ok: true; output?: unknown } | { ok: false; error: string };

export async function executeHttp(spec: any, runId: string, db: any): Promise<StepOutcome> {
  const config = spec.config;
  const timeoutSec = spec.timeout_sec ?? 30;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown = text;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try { body = JSON.parse(text); } catch { /* keep text */ }
    }

    if (response.status >= 500) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return {
      ok: true,
      output: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      },
    };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('aborted')) {
      return { ok: false, error: `Timeout after ${timeoutSec}s` };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
```

Test:

```ts
import nock from 'nock';
import { executeHttp } from './http.js';

it('returns ok on 200', async () => {
  nock('https://api.example.com').get('/data').reply(200, { foo: 'bar' });
  const result = await executeHttp({
    config: { url: 'https://api.example.com/data', method: 'GET' },
    timeout_sec: 5,
  }, 'run1', null);
  expect(result.ok).toBe(true);
});

it('returns error on 500', async () => {
  nock('https://api.example.com').get('/data').reply(500);
  const result = await executeHttp({
    config: { url: 'https://api.example.com/data', method: 'GET' },
    timeout_sec: 5,
  }, 'run1', null);
  expect(result.ok).toBe(false);
});
```

## Files Involved

- `packages/worker/src/handlers/http.ts`
- `packages/worker/src/handlers/http.test.ts`

## How to Verify

```bash
pnpm add -F @flowforge/worker -D nock
pnpm -F @flowforge/worker test http
```
