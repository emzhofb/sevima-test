# [Epic-15] Cleanup old logs script

**Labels**: `epic-15`, `good-first-issue`, `area-data`, `stretch`
**Estimate**: 1 jam
**Depends on**: #14

## Context

> Original spec: hot/warm/cold tier. Versi fresh grad: simple cleanup script yang DROP partition lama (>30 hari) atau DELETE row.

## Acceptance Criteria

- [ ] Script `scripts/cleanup-logs.ts` hapus log > 30 hari
- [ ] Run via cron / kubernetes CronJob
- [ ] Log apa yang di-delete

## Implementation Hints

```ts
import { createDbClient, loadConfig, createLogger } from '@flowforge/shared';

async function cleanup() {
  const log = createLogger('cleanup');
  const db = createDbClient(loadConfig());

  // Drop partition older than 30 days
  const partitionsRes = await db.query<{ partition_name: string }>(
    `SELECT child.relname AS partition_name
     FROM pg_inherits
     JOIN pg_class child ON pg_inherits.inhrelid = child.oid
     JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
     WHERE parent.relname = 'logs'`,
  );

  // For simplicity: DELETE rows older than 30 days
  const result = await db.query(
    `DELETE FROM logs WHERE ts < now() - interval '30 days'`,
  );
  log.info({ deleted: result.rowCount }, 'Cleaned up old logs');

  await db.end();
}

cleanup().catch((err) => { console.error(err); process.exit(1); });
```

Add to docker-compose as one-shot cron container or run via host crontab:

```cron
# Run daily at 03:00
0 3 * * * cd /app && pnpm tsx scripts/cleanup-logs.ts >> /var/log/flowforge-cleanup.log 2>&1
```

## Files Involved

- `scripts/cleanup-logs.ts`

## How to Verify

```bash
pnpm tsx scripts/cleanup-logs.ts
```
