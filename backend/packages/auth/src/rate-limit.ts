import type { Redis } from 'ioredis';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { rateLimitHitTotal } from '@flowforge/shared';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

/**
 * Check rate limit using sliding window algorithm
 * @param redis Redis client instance
 * @param key Rate limit key (e.g., "tenant:route")
 * @param limit Maximum requests allowed in the window
 * @param windowSec Window size in seconds
 * @returns RateLimitResult with allowed status and optional retryAfterSec
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `rl:${key}:${Math.floor(now / windowSec)}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, windowSec + 1);
  }

  if (count > limit) {
    const ttl = await redis.ttl(windowKey);
    return { allowed: false, retryAfterSec: Math.max(1, ttl) };
  }

  return { allowed: true };
}

export interface RateLimitMiddlewareOptions {
  limit?: number;
  windowSec?: number;
}

/**
 * Create a rate limit middleware for Fastify
 * @param redis Redis client instance
 * @param opts Configuration options (limit, windowSec)
 * @returns Fastify preHandler middleware function
 */
export function createRateLimitMiddleware(
  redis: Redis,
  opts: RateLimitMiddlewareOptions = { limit: 600, windowSec: 60 },
) {
  const limit = opts.limit ?? 600;
  const windowSec = opts.windowSec ?? 60;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.ctx || !request.ctx.tenant_id) {
      return;
    }

    const key = `${request.ctx.tenant_id}:${request.routeOptions.url ?? request.url}`;
    const result = await checkRateLimit(redis, key, limit, windowSec);

    if (!result.allowed) {
      rateLimitHitTotal.inc({ tenant: request.ctx?.tenant_id ?? 'unknown' });
      reply.header('Retry-After', String(result.retryAfterSec));
      return reply.code(429).send({
        error: 'rate_limited',
        retry_after: result.retryAfterSec,
      });
    }
  };
}
