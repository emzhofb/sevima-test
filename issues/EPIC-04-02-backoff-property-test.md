# [Epic-04] Backoff bounded property test (table-based)

**Labels**: `epic-04`, `area-shared`, `area-testing`
**Estimate**: 0.5 jam
**Depends on**: #36

## Context

Property: `0 <= computeBackoff(a, p) <= p.backoff_max_ms` untuk semua a dan p valid. Kita uji dengan table cases beragam (versi fresh grad, bukan fast-check).

## Acceptance Criteria

- [ ] Test menjalankan computeBackoff untuk minimal 50 kombinasi attempt (1-15) × policy variants
- [ ] Assert hasil selalu di rentang [0, backoff_max_ms]

## Implementation Hints

```ts
// packages/shared/src/backoff.property.test.ts
import { describe, it, expect } from 'vitest';
import { computeBackoff } from './backoff.js';

describe('backoff bounded property', () => {
  const policies = [
    { max_attempts: 5, backoff_base_ms: 100, backoff_max_ms: 1000, jitter: false },
    { max_attempts: 5, backoff_base_ms: 100, backoff_max_ms: 1000, jitter: true },
    { max_attempts: 10, backoff_base_ms: 50, backoff_max_ms: 5000, jitter: true },
    { max_attempts: 3, backoff_base_ms: 1, backoff_max_ms: 100, jitter: true },
    { max_attempts: 5, backoff_base_ms: 1000, backoff_max_ms: 30000, jitter: false },
  ];

  for (const policy of policies) {
    for (let attempt = 1; attempt <= 15; attempt++) {
      it(`attempt=${attempt} base=${policy.backoff_base_ms} max=${policy.backoff_max_ms} jitter=${policy.jitter}`, () => {
        const delay = computeBackoff(attempt, policy);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(policy.backoff_max_ms);
      });
    }
  }
});
```

## Files Involved

- `packages/shared/src/backoff.property.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/shared test backoff.property
```
