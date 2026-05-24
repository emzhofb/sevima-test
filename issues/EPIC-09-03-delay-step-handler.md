# [Epic-09] DELAY step handler

**Labels**: `epic-09`, `good-first-issue`, `area-worker`
**Estimate**: 0.5 jam
**Depends on**: #71

## Context

Sleep selama `duration_ms` ms. Cap di 1 jam (3,600,000 ms).

## Acceptance Criteria

- [ ] Function `executeDelay(spec)` mengembalikan setelah `duration_ms`
- [ ] Reject duration > 3,600,000 ms

## Implementation Hints

```ts
// packages/worker/src/handlers/delay.ts
export async function executeDelay(spec: any): Promise<StepOutcome> {
  const ms = spec.config.duration_ms;
  if (typeof ms !== 'number' || ms <= 0 || ms > 3_600_000) {
    return { ok: false, error: 'Invalid duration_ms' };
  }
  await new Promise((r) => setTimeout(r, ms));
  return { ok: true, output: { delayed_ms: ms } };
}
```

Test:

```ts
it('delays for specified duration', async () => {
  const start = Date.now();
  const result = await executeDelay({ config: { duration_ms: 100 } });
  expect(Date.now() - start).toBeGreaterThanOrEqual(100);
  expect(result.ok).toBe(true);
});

it('rejects invalid duration', async () => {
  const result = await executeDelay({ config: { duration_ms: -1 } });
  expect(result.ok).toBe(false);
});
```

## Files Involved

- `packages/worker/src/handlers/delay.ts`
- `packages/worker/src/handlers/delay.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/worker test delay
```
