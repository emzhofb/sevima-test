# [Epic-10] Scheduler tick (single-replica with FOR UPDATE)

**Labels**: `epic-10`, `area-scheduler`
**Estimate**: 2 jam
**Depends on**: #83 (schedule repo)

## Context

> Single-replica version (fresh grad). Multi-replica perlu SKIP LOCKED yang lebih advanced. Kalau scheduler crash, ada gap sementara — acceptable untuk MVP.

Tick: ambil schedule yang `next_run_at <= now` AND enabled, trigger run, advance next_run_at.

## Acceptance Criteria

- [ ] Function `schedulerTick(db, broker)`
- [ ] Pakai `FOR UPDATE` untuk lock row sambil proses
- [ ] Compute `next_run_at` baru pakai `cron-parser`
- [ ] Loop interval 5 detik
- [ ] Test integration

## Implementation Hints

```bash
pnpm add -F @flowforge/scheduler cron-parser
```

```ts
// packages/scheduler/src/tick.ts
import cronParser from 'cron-parser';
import { withTransaction, type Db, type Broker } from '@flowforge/shared';
import { createRun } from '../../api/src/repos/run.repo.js'; // or duplicate

export async function schedulerTick(db: Db, broker: Broker): Promise<number> {
  let triggered = 0;

  await withTransaction(db, async (client) => {
    // FOR UPDATE memastikan tidak ada race kalau multi-replica
    const dueRes = await client.query(
      `SELECT s.*, w.current_version, v.id as version_id
       FROM schedules s
       JOIN workflows w ON w.id = s.workflow_id
       JOIN workflow_versions v ON v.workflow_id = w.id AND v.version = w.current_version
       WHERE s.enabled = true
         AND s.next_run_at <= now()
       ORDER BY s.next_run_at ASC
       LIMIT 100
       FOR UPDATE OF s SKIP LOCKED`,
    );

    for (const schedule of dueRes.rows) {
      // Trigger run
      const runRes = await client.query(
        `INSERT INTO runs (tenant_id, workflow_id, version_id, trigger_type, input, status)
         VALUES ($1, $2, $3, 'SCHEDULED', '{}', 'PENDING')
         RETURNING id`,
        [schedule.tenant_id, schedule.workflow_id, schedule.version_id],
      );
      const runId = runRes.rows[0].id;

      // Advance next_run_at
      const interval = cronParser.parseExpression(schedule.cron_expr, {
        currentDate: new Date(),
        tz: schedule.tz,
      });
      const nextAt = interval.next().toDate();

      await client.query(
        'UPDATE schedules SET next_run_at = $1 WHERE id = $2',
        [nextAt, schedule.id],
      );

      await broker.enqueue('flowforge:runs', {
        run_id: runId,
        tenant_id: schedule.tenant_id,
      });

      triggered++;
    }
  });

  return triggered;
}

export function startScheduler(db: Db, broker: Broker, intervalMs = 5000): () => void {
  let running = true;
  const tick = async () => {
    while (running) {
      try {
        await schedulerTick(db, broker);
      } catch (err) {
        console.error('Scheduler error', err);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };
  tick();
  return () => { running = false; };
}
```

## Files Involved

- `packages/scheduler/src/tick.ts`
- `packages/scheduler/src/index.ts`
- Test file

## How to Verify

Test: create schedule with `next_run_at` in past, run tick, verify run created + `next_run_at` advanced.

```bash
pnpm -F @flowforge/scheduler test
```
