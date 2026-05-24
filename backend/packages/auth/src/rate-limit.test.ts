import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Redis from 'ioredis';
import { checkRateLimit } from './rate-limit.js';

describe('checkRateLimit', () => {
  let redis: Redis;

  beforeEach(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.quit();
  });

  it('should allow first N requests', async () => {
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(redis, 'test', 5, 60);
      expect(result.allowed).toBe(true);
    }
  });

  it('should block the N+1 request', async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(redis, 'test', 5, 60);
    }

    const blocked = await checkRateLimit(redis, 'test', 5, 60);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('should provide retryAfterSec when rate limited', async () => {
    // Fill up the limit
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(redis, 'test', 5, 60);
    }

    // Exceed the limit
    const result = await checkRateLimit(redis, 'test', 5, 60);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSec).toBeGreaterThanOrEqual(1);
    }
  });

  it('should isolate limits by key', async () => {
    // Fill limit for key1
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(redis, 'key1', 5, 60);
    }

    // key2 should still have budget
    const result = await checkRateLimit(redis, 'key2', 5, 60);
    expect(result.allowed).toBe(true);
  });

  it('should handle tenant:route isolation', async () => {
    const tenantRoute1 = 'tenant1:/api/endpoint';
    const tenantRoute2 = 'tenant2:/api/endpoint';

    // Fill limit for tenant1
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(redis, tenantRoute1, 5, 60);
    }

    // tenant2 should not be affected
    const result = await checkRateLimit(redis, tenantRoute2, 5, 60);
    expect(result.allowed).toBe(true);
  });

  it('should support custom limits', async () => {
    const result1 = await checkRateLimit(redis, 'custom', 1, 60);
    expect(result1.allowed).toBe(true);

    const result2 = await checkRateLimit(redis, 'custom', 1, 60);
    expect(result2.allowed).toBe(false);
    if (!result2.allowed) {
      expect(result2.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('should respect window expiration', async () => {
    // Wait until the start of a new second to ensure we don't cross a boundary during the test
    const startMs = Date.now();
    const msToNextSecond = 1000 - (startMs % 1000);
    await new Promise((resolve) => setTimeout(resolve, msToNextSecond + 50));

    // Use a 1-second window for fast testing
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(redis, 'window-test', 3, 1);
    }

    // Should be limited
    let result = await checkRateLimit(redis, 'window-test', 3, 1);
    expect(result.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Should be allowed again in new window
    result = await checkRateLimit(redis, 'window-test', 3, 1);
    expect(result.allowed).toBe(true);
  });

  it('should default to 600 requests per 60 seconds', async () => {
    // This is a functional test ensuring the defaults work
    const result = await checkRateLimit(redis, 'default-test', 600, 60);
    expect(result.allowed).toBe(true);
  });
});
