import { describe, it, expect } from 'vitest';
import { SlugSchema, RetryPolicySchema } from './workflow.js';

describe('SlugSchema', () => {
  it.each([
    ['valid-slug', true],
    ['acme-corp', true],
    ['acme', true],
    ['Acme', false],
    ['-bad', false],
    ['too-long-' + 'a'.repeat(60), false],
  ])('slug %s -> %s', (slug, valid) => {
    expect(SlugSchema.safeParse(slug).success).toBe(valid);
  });
});

describe('RetryPolicySchema', () => {
  it('rejects max_attempts > 10', () => {
    expect(
      RetryPolicySchema.safeParse({
        max_attempts: 11,
        backoff_base_ms: 100,
        backoff_max_ms: 1000,
        jitter: true,
      }).success,
    ).toBe(false);
  });

  it('rejects max_attempts < 1', () => {
    expect(
      RetryPolicySchema.safeParse({
        max_attempts: 0,
        backoff_base_ms: 100,
        backoff_max_ms: 1000,
        jitter: true,
      }).success,
    ).toBe(false);
  });
});
