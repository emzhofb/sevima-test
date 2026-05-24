import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { RedisStreamBroker } from './broker.js';

describe('RedisStreamBroker', () => {
  let redis: any;
  let broker: RedisStreamBroker;

  beforeEach(async () => {
    // ioredis-mock might not support Streams completely, so we mock the stream methods manually.
    redis = new RedisMock();

    redis.xadd = vi.fn().mockResolvedValue('12345-0');
    redis.xgroup = vi.fn().mockResolvedValue('OK');
    redis.xreadgroup = vi
      .fn()
      .mockResolvedValue([['test-stream', [['12345-0', ['run_id', 'r1']]]]]);
    redis.xack = vi.fn().mockResolvedValue(1);

    broker = new RedisStreamBroker(redis as any);
  });

  it('enqueue calls xadd', async () => {
    const id = await broker.enqueue('test-stream', { run_id: 'r1' });
    expect(id).toBe('12345-0');
    expect(redis.xadd).toHaveBeenCalledWith('test-stream', '*', 'run_id', 'r1');
  });

  it('ensureGroup calls xgroup', async () => {
    await broker.ensureGroup('test-stream', 'test-group');
    expect(redis.xgroup).toHaveBeenCalledWith(
      'CREATE',
      'test-stream',
      'test-group',
      '$',
      'MKSTREAM',
    );
  });

  it('dequeue calls xreadgroup and parses result', async () => {
    const msg = await broker.dequeue('test-stream', 'test-group', 'c1', 1000);
    expect(msg).not.toBeNull();
    expect(msg!.id).toBe('12345-0');
    expect(msg!.payload.run_id).toBe('r1');
    expect(redis.xreadgroup).toHaveBeenCalledWith(
      'GROUP',
      'test-group',
      'c1',
      'COUNT',
      1,
      'BLOCK',
      1000,
      'STREAMS',
      'test-stream',
      '>',
    );
  });

  it('dequeue returns null if result is empty', async () => {
    redis.xreadgroup.mockResolvedValueOnce(null);
    const msg = await broker.dequeue('test-stream', 'test-group', 'c1', 100);
    expect(msg).toBeNull();
  });

  it('ack calls xack', async () => {
    await broker.ack('test-stream', 'test-group', '12345-0');
    expect(redis.xack).toHaveBeenCalledWith('test-stream', 'test-group', '12345-0');
  });
});
