# [Epic-09] Write step execution logs to logs table

**Labels**: `epic-09`, `area-worker`
**Estimate**: 1 jam
**Depends on**: #14 (logs migration), #71

## Context

Setiap step execution menulis stdout/stderr ke `logs` table dengan tenant_id, run_id, step_id, ts.

## Acceptance Criteria

- [ ] Function `appendLogs(db, entries[])`
- [ ] Worker tulis log saat START / SUCCESS / FAILURE
- [ ] HTTP handler tulis URL + status
- [ ] Script handler tulis stdout (truncated 100KB)

## Implementation Hints

```ts
// packages/shared/src/logs.ts
import type { Db } from './db.js';

export type LogEntry = {
  tenant_id: string;
  run_id: string;
  step_id: string;
  ts: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  fields?: Record<string, unknown>;
};

export async function appendLogs(db: Db, entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const idx = i * 7;
    values.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7})`);
    params.push(e.tenant_id, e.run_id, e.step_id, e.ts, e.level, e.message, e.fields ?? {});
  }

  await db.query(
    `INSERT INTO logs (tenant_id, run_id, step_id, ts, level, message, fields)
     VALUES ${values.join(',')}`,
    params,
  );
}
```

Wire ke worker:

```ts
// In worker step processing:
await appendLogs(db, [{
  tenant_id: tenantId, run_id, step_id, ts: new Date(),
  level: 'INFO', message: `Step ${step_id} started (attempt ${attempt})`,
}]);

// After execution:
await appendLogs(db, [{
  tenant_id: tenantId, run_id, step_id, ts: new Date(),
  level: outcome.ok ? 'INFO' : 'ERROR',
  message: outcome.ok ? 'Step succeeded' : `Step failed: ${outcome.error}`,
  fields: outcome.ok ? { output: outcome.output } : { error: outcome.error },
}]);
```

## Files Involved

- `packages/shared/src/logs.ts`
- Update `packages/worker/src/index.ts`

## How to Verify

```bash
pnpm test
psql $DATABASE_URL -c "SELECT * FROM logs LIMIT 10;"
```
