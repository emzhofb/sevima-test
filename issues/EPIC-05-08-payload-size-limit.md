# [Epic-05] Payload size limit (1 MB)

**Labels**: `epic-05`, `good-first-issue`, `area-api`
**Estimate**: 0.5 jam
**Depends on**: #41

## Context

Reject request body > 1 MB dengan 413. Fastify punya built-in option `bodyLimit`.

## Acceptance Criteria

- [ ] Fastify configured dengan `bodyLimit: 1048576` (1 MB)
- [ ] Test: body 2 MB → 413 response
- [ ] Test: body 500 KB → 200 OK

## Implementation Hints

```ts
// packages/api/src/app.ts
const app = Fastify({
  bodyLimit: 1024 * 1024, // 1 MB
});
```

Test:

```ts
it('rejects body > 1 MB with 413', async () => {
  const huge = 'x'.repeat(2 * 1024 * 1024);
  const res = await app.inject({
    method: 'POST',
    url: '/workflows',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ name: 'huge', definition: { extra: huge } }),
  });
  expect(res.statusCode).toBe(413);
});
```

## Files Involved

- `packages/api/src/app.ts`
- Test file existing

## How to Verify

```bash
pnpm -F @flowforge/api test
```
