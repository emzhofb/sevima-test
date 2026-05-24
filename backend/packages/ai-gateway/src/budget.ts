import type { Redis } from 'ioredis';

const DAILY_LIMIT = 100_000;

function todayKey(tenantId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `ai-budget:${tenantId}:${today}`;
}

function secondsUntilEndOfDay(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
}

export async function checkTokenBudget(
  redis: Redis,
  tenantId: string,
  requestedTokens: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const used = Number(await redis.get(todayKey(tenantId))) || 0;
  const remaining = DAILY_LIMIT - used;
  return { allowed: requestedTokens <= remaining, remaining: Math.max(0, remaining) };
}

export async function recordTokenUsage(
  redis: Redis,
  tenantId: string,
  usedTokens: number,
): Promise<void> {
  const key = todayKey(tenantId);
  const ttl = secondsUntilEndOfDay();
  await redis
    .multi()
    .incrby(key, usedTokens)
    .expire(key, ttl)
    .exec();
}
