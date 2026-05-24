# [Epic-04] Implement computeBackoff function

**Labels**: `epic-04`, `good-first-issue`, `area-shared`
**Estimate**: 1 jam
**Depends on**: #16 (shared types)

## Context

Exponential backoff dengan optional jitter. Dipakai oleh worker untuk schedule retry.

## Acceptance Criteria

- [ ] Function `computeBackoff(attempt: number, policy: RetryPolicy): number`
- [ ] Eksponensial: `base * 2^(attempt-1)`, capped di `backoff_max_ms`
- [ ] Jitter: full random `[0, capped]` kalau `jitter=true`
- [ ] Validasi precondition (attempt >= 1, base > 0)
- [ ] Test untuk berbagai input

## Implementation Hints

```ts
// packages/shared/src/backoff.ts
import type { RetryPolicy } from './schemas/workflow.js';

export function computeBackoff(attempt: number, policy: RetryPolicy): number {
  if (attempt < 1) throw new Error('attempt must be >= 1');
  if (policy.backoff_base_ms <= 0) throw new Error('backoff_base_ms must be > 0');

  const exponential = policy.backoff_base_ms * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, policy.backoff_max_ms);

  if (policy.jitter) {
    return Math.floor(Math.random() * capped);
  }

  return capped;
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import { computeBackoff } from './backoff.js';

const basePolicy = {
  max_attempts: 5,
  backoff_base_ms: 100,
  backoff_max_ms: 10_000,
  jitter: false,
};

describe('computeBackoff', () => {
  it('attempt 1: base', () => {
    expect(computeBackoff(1, basePolicy)).toBe(100);
  });

  it('attempt 2: 2x base', () => {
    expect(computeBackoff(2, basePolicy)).toBe(200);
  });

  it('attempt 3: 4x base', () => {
    expect(computeBackoff(3, basePolicy)).toBe(400);
  });

  it('caps at backoff_max_ms', () => {
    expect(computeBackoff(20, basePolicy)).toBe(10_000);
  });

  it('with jitter: bounded by [0, capped]', () => {
    const policy = { ...basePolicy, jitter: true };
    for (let i = 0; i < 100; i++) {
      const delay = computeBackoff(3, policy);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(400);
    }
  });

  it('throws on attempt < 1', () => {
    expect(() => computeBackoff(0, basePolicy)).toThrow();
  });
});
```

## Files Involved

- `packages/shared/src/backoff.ts`
- `packages/shared/src/backoff.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/shared test backoff
```
