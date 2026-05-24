import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockPoolInstance, poolConstructor } = vi.hoisted(() => {
  const instance = {
    on: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  };

  return {
    mockPoolInstance: instance,
    poolConstructor: vi.fn(function PoolMock() {
      return instance;
    }),
  };
});

vi.mock('pg', () => ({
  Pool: poolConstructor,
}));

import { createDbClient, withTransaction } from './db.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('createDbClient', () => {
  it('creates a pool with graceful shutdown hooks', () => {
    const onceSpy = vi.spyOn(process, 'once').mockReturnValue(process);

    const pool = createDbClient({ DATABASE_URL: 'postgres://user:pass@localhost:5432/db' });

    expect(pool).toBe(mockPoolInstance);
    expect(poolConstructor).toHaveBeenCalledWith({
      connectionString: 'postgres://user:pass@localhost:5432/db',
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    expect(mockPoolInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    onceSpy.mockRestore();
  });
});

describe('withTransaction', () => {
  it('commits successful work and releases the client', async () => {
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue(undefined);
    const client = { query, release };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    const result = await withTransaction(pool as never, async () => 'ok');

    expect(result).toBe('ok');
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back on error and releases the client', async () => {
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue(undefined);
    const client = { query, release };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(
      withTransaction(pool as never, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });
});