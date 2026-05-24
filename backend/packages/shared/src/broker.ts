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
    const streamResult = result[0];
    if (!streamResult) return null;
    
    const [, entries] = streamResult;
    if (!entries || entries.length === 0) return null;

    const entry = entries[0];
    if (!entry) return null;
    
    const [id, fields] = entry;
    const payload: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const val = fields[i + 1];
      if (key !== undefined && val !== undefined) {
        payload[key] = val;
      }
    }
    return { id, payload };
  }

  async ack(stream: string, group: string, messageId: string): Promise<void> {
    await this.redis.xack(stream, group, messageId);
  }
}
