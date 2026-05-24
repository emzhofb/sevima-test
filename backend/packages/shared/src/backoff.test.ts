import { describe, expect, it } from 'vitest';

import { computeBackoff } from './backoff.js';

const basePolicy = {
  max_attempts: 5,
  backoff_base_ms: 100,
  backoff_max_ms: 10_000,
  jitter: false,
};

describe('computeBackoff', () => {
  it('returns the exponential backoff without jitter', () => {
    expect(computeBackoff(1, basePolicy)).toBe(100);
    expect(computeBackoff(2, basePolicy)).toBe(200);
    expect(computeBackoff(3, basePolicy)).toBe(400);
  });

  it('caps the delay at backoff_max_ms', () => {
    expect(computeBackoff(20, basePolicy)).toBe(10_000);
  });

  it('returns a bounded random delay when jitter is enabled', () => {
    const policy = { ...basePolicy, jitter: true };

    for (let i = 0; i < 100; i += 1) {
      const delay = computeBackoff(3, policy);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(400);
    }
  });

  it('throws when attempt is below 1', () => {
    expect(() => computeBackoff(0, basePolicy)).toThrow('attempt must be >= 1');
  });
});
