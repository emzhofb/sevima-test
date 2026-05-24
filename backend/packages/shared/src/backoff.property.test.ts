import { describe, expect, it } from 'vitest';

import { computeBackoff } from './backoff.js';

const policies = [
  { max_attempts: 5, backoff_base_ms: 100, backoff_max_ms: 1000, jitter: false },
  { max_attempts: 5, backoff_base_ms: 100, backoff_max_ms: 1000, jitter: true },
  { max_attempts: 10, backoff_base_ms: 50, backoff_max_ms: 5000, jitter: true },
  { max_attempts: 3, backoff_base_ms: 1, backoff_max_ms: 100, jitter: true },
  { max_attempts: 5, backoff_base_ms: 1000, backoff_max_ms: 30000, jitter: false },
];

describe('backoff bounded property', () => {
  for (const policy of policies) {
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      it(`attempt=${attempt} base=${policy.backoff_base_ms} max=${policy.backoff_max_ms} jitter=${policy.jitter}`, () => {
        const delay = computeBackoff(attempt, policy);

        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(policy.backoff_max_ms);
      });
    }
  }
});
