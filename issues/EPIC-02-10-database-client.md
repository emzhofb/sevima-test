# [Epic-02] Database client wrapper (pg pool)

**Labels**: `epic-02`, `good-first-issue`, `area-data`
**Estimate**: 1 jam
**Depends on**: #6 (config), #9 (migration runner)

## Context

Wrapper sederhana di atas `pg` Pool untuk dipakai semua repository.

## Acceptance Criteria

- [ ] `packages/shared/src/db.ts` ekspor `createDbClient()` mengembalikan Pool
- [ ] Helper `withTransaction(client, fn)` untuk transaksi
- [ ] Pool di-close graceful saat process exit

## Implementation Hints

```bash
pnpm add -F @flowforge/shared pg
pnpm add -F @flowforge/shared -D @types/pg
```

`packages/shared/src/db.ts`:

```ts
import pg from 'pg';
import type { Config } from './config.js';

const { Pool } = pg;

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

export function createDbClient(config: Pick<Config, 'DATABASE_URL'>): Db {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected error on idle PG client', err);
  });

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
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import { createDbClient, withTransaction } from './db.js';

describe('withTransaction', () => {
  it('rolls back on error', async () => {
    const pool = createDbClient({ DATABASE_URL: process.env.DATABASE_URL! });
    await expect(
      withTransaction(pool, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await pool.end();
  });
});
```

## Files Involved

- `packages/shared/src/db.ts`
- `packages/shared/src/db.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/shared test
```
