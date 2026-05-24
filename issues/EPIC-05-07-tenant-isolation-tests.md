# [Epic-05] Tenant isolation integration tests

**Labels**: `epic-05`, `area-auth`, `area-testing`
**Estimate**: 1.5 jam
**Depends on**: #43 (login), #20 (workflow repo)

## Context

Tes konkret bahwa user tenant A tidak bisa lihat data tenant B. Ini critical untuk security.

## Acceptance Criteria

- [ ] Test setup: 2 tenant, 2 user, 2 workflow
- [ ] Test: user tenant A list workflows → hanya tampil workflow tenant A
- [ ] Test: user tenant A getById workflow milik tenant B → 404 (bukan 403, jangan beri info bahwa data exist di tenant lain)
- [ ] Test: user tenant A update workflow milik tenant B → 404

## Implementation Hints

```ts
// packages/api/src/routes/workflow.tenant-isolation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';

describe('tenant isolation on workflows', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tokenA: string;
  let tokenB: string;
  let workflowAId: string;
  let workflowBId: string;

  beforeEach(async () => {
    app = await buildApp();
    // Setup 2 tenants
    // tokenA = JWT untuk user di tenant A
    // tokenB = JWT untuk user di tenant B
    // Create workflow X di tenant A → workflowAId
    // Create workflow Y di tenant B → workflowBId
  });

  it('list workflows: tenant A sees only A workflows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/workflows',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const ids = res.json().items.map((w: any) => w.id);
    expect(ids).toContain(workflowAId);
    expect(ids).not.toContain(workflowBId);
  });

  it('getById: tenant A on tenant B workflow returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/workflows/${workflowBId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('update: tenant A on tenant B workflow returns 404', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/workflows/${workflowBId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { definition: { name: 'hijack', timeout_sec: 60, steps: [] } },
    });
    expect(res.statusCode).toBe(404);
  });

  it('delete: tenant A on tenant B workflow returns 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/workflows/${workflowBId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

## Files Involved

- `packages/api/src/routes/workflow.tenant-isolation.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test tenant-isolation
```
