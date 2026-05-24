import { Pool, type PoolClient } from 'pg';

import type { Config } from './config.js';

export type Db = Pool;
export type DbClient = PoolClient;

export function createDbClient(config: Pick<Config, 'DATABASE_URL'>): Db {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  pool.on('error', (error) => {
    console.error('Unexpected error on idle PG client', error);
  });

  const shutdown = () => {
    void pool.end();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return pool;
}

export async function withTransaction<T>(
  pool: Db,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
