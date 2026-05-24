import { describe, it, expect } from 'vitest';
import RedisMock from 'ioredis-mock';
import { checkTokenBudget, recordTokenUsage } from './budget.js';

describe('Token budget tracker', () => {
  it('allows usage within limits and blocks when limit is exceeded', async () => {
    const redis = new RedisMock();
    const tenantId = 'test-tenant';

    // Initial check
    let budget = await checkTokenBudget(redis, tenantId, 1000);
    expect(budget.allowed).toBe(true);
    expect(budget.remaining).toBe(100_000);

    // Record usage
    await recordTokenUsage(redis, tenantId, 95_000);

    // Check again
    budget = await checkTokenBudget(redis, tenantId, 6000);
    expect(budget.allowed).toBe(false);
    expect(budget.remaining).toBe(5000);

    // Allow exactly remaining
    budget = await checkTokenBudget(redis, tenantId, 5000);
    expect(budget.allowed).toBe(true);
  });
});
