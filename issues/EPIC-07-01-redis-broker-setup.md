# [Epic-07] Redis broker abstraction (Streams)

**Labels**: `epic-07`, `area-broker`
**Estimate**: 2 jam
**Depends on**: #5 (docker), #6 (config)

## Context

Pakai Redis Streams sebagai message broker untuk run + step queue. Wrap di interface sederhana agar bisa di-swap nanti.

## Acceptance Criteria

- [ ] `packages/shared/src/broker.ts` ekspor `Broker` interface
- [ ] Implementasi `RedisStreamBroker` dengan `enqueue`, `dequeue` (blocking), `ack`
- [ ] Test integration dengan Redis

## Implementation Hints

```ts
// packages/shared/src/broker.ts
import type { Redis } from 'ioredis';

export type BrokerMessage = {
  id: string; // Redis stream entry ID
  payload: Record<string, string>;
};

export interface Broker {
  enqueue(stream: string, payload: Record<string, string>): Promise<string>;
  dequeue(stream: string, group: string, consumer: string, timeoutMs: number): Promise<BrokerMessage | null>;
  ack(stream: string, group: string, messageId: string): Promise<void>;
  ensureGroup(stream: string, group: string): Promise<void>;
}

export class RedisStreamBroker implements Broker {
  constructor(private redis: Redis) {}

  async enqueue(stream: string, payload: Record<string, string>): Promise<string> {
    const args: string[] = [];
    for (const [k, v] of Object.entries(payload)) {
      args.push(k, v);
    }
    return await this.redis.xadd(stream, '*', ...args) as string;
  }

  async ensureGroup(stream: string, group: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes('BUSYGROUP')) throw err;
    }
  }

  async dequeue(
    stream: string,
    group: string,
    consumer: string,
    timeoutMs = 5000,
  ): Promise<BrokerMessage | null> {
    const result = await this.redis.xreadgroup(
      'GROUP', group, consumer,
      'COUNT', 1,
      'BLOCK', timeoutMs,
      'STREAMS', stream, '>',
    ) as [string, [string, string[]][]][] | null;

    if (!result || result.length === 0) return null;
    const [, entries] = result[0];
    if (entries.length === 0) return null;

    const [id, fields] = entries[0];
    const payload: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      payload[fields[i]] = fields[i + 1];
    }
    return { id, payload };
  }

  async ack(stream: string, group: string, messageId: string): Promise<void> {
    await this.redis.xack(stream, group, messageId);
  }
}
```

Test:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { RedisStreamBroker } from './broker.js';

describe('RedisStreamBroker', () => {
  const redis = new Redis(process.env.REDIS_URL!);
  const broker = new RedisStreamBroker(redis);

  beforeEach(async () => {
    await redis.del('test-stream');
  });

  it('enqueue and dequeue', async () => {
    await broker.ensureGroup('test-stream', 'test-group');
    const id = await broker.enqueue('test-stream', { run_id: 'r1' });
    expect(id).toBeDefined();

    const msg = await broker.dequeue('test-stream', 'test-group', 'c1', 1000);
    expect(msg).not.toBeNull();
    expect(msg!.payload.run_id).toBe('r1');

    await broker.ack('test-stream', 'test-group', msg!.id);
  });

  it('dequeue returns null on timeout', async () => {
    await broker.ensureGroup('empty-stream', 'g');
    const msg = await broker.dequeue('empty-stream', 'g', 'c1', 100);
    expect(msg).toBeNull();
  });
});
```

## Files Involved

- `packages/shared/src/broker.ts`
- `packages/shared/src/broker.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/shared test broker
```
