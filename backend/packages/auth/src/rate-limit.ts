import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

const DEFAULT_LIMIT = 600;
const DEFAULT_WINDOW_SEC = 60;

type RateLimitRedis = Pick<Redis, 'zremrangebyscore' | 'zadd' | 'zcard' | 'zrange' | 'expire'>;

export async function checkRateLimit(
  redis: RateLimitRedis,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowMs = windowSec * 1000;
  const redisKey = `rl:${key}`;
  const member = `${nowMs}:${Math.random().toString(36).slice(2)}`;

  await redis.zremrangebyscore(redisKey, '-inf', nowMs - windowMs);
  await redis.zadd(redisKey, nowMs, member);
  const count = await redis.zcard(redisKey);
  await redis.expire(redisKey, windowSec + 1);

  if (count > limit) {
    const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldestScore + windowMs - nowMs) / 1000));
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

export function rateLimitMiddleware(
  redis: RateLimitRedis,
  opts: { limit?: number; windowSec?: number } = {},
) {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowSec = opts.windowSec ?? DEFAULT_WINDOW_SEC;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.ctx) return;

    const route = request.routeOptions.url ?? request.url.split('?')[0];
    const key = `${request.ctx.tenant_id}:${route}`;
    const result = await checkRateLimit(redis, key, limit, windowSec);

    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfterSec));
      return reply.code(429).send({ error: 'rate_limited', retry_after: result.retryAfterSec });
    }
  };
}
