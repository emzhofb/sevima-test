# [Epic-14] API client helper with auth header

**Labels**: `epic-14`, `good-first-issue`, `area-frontend`
**Estimate**: 1 jam
**Depends on**: #103

## Context

Wrapper `fetch()` yang otomatis attach `Authorization` header dan handle 401 (redirect login).

## Acceptance Criteria

- [ ] `src/lib/api.ts` ekspor `api(path, options)`
- [ ] Otomatis tambah Bearer token dari localStorage
- [ ] Auto redirect ke login kalau 401
- [ ] JSON parse otomatis

## Implementation Hints

```ts
// packages/web/src/lib/api.ts
const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new ApiError(response.status, response.statusText, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
```

## Files Involved

- `packages/web/src/lib/api.ts`

## How to Verify

Manual: panggil `api('/health')` di console.
