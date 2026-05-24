# [Epic-08] Global timeout scanner

**Labels**: `epic-08`, `area-orchestrator`
**Estimate**: 1.5 jam
**Depends on**: #63

## Context

Periodic job (setiap 5 detik) cek run yang melewati timeout, mark TIMED_OUT.

## Acceptance Criteria

- [ ] Function `scanTimeouts(db)` yang cek semua run RUNNING
- [ ] Kalau `now - started_at > timeout_sec` (dari workflow definition) → TIMED_OUT
- [ ] Loop interval 5 detik
- [ ] Test

## Implementation Hints

```ts
// packages/orchestrator/src/timeout-scanner.ts
import type { Db } from '@flowforge/shared';

export async function scanTimeouts(db: Db): Promise<number> {
  // Cari runs RUNNING yang sudah lewat timeout
  const result = await db.query(
    `WITH timed_out AS (
       SELECT r.id
       FROM runs r
       JOIN workflow_versions v ON v.id = r.version_id
       WHERE r.status = 'RUNNING'
         AND r.started_at IS NOT NULL
         AND r.started_at + ((v.definition->>'timeout_sec')::int * interval '1 second') < now()
       LIMIT 100
     )
     UPDATE runs SET status = 'TIMED_OUT', finished_at = now()
     WHERE id IN (SELECT id FROM timed_out)
     RETURNING id`,
  );
  return result.rowCount ?? 0;
}

export function startTimeoutScanner(db: Db, intervalMs = 5000): () => void {
  let running = true;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    if (!running) return;
    try {
      const count = await scanTimeouts(db);
      if (count > 0) {
        // log: marked N runs TIMED_OUT
      }
    } catch (err) {
      console.error('Timeout scanner error', err);
    } finally {
      if (running) timer = setTimeout(tick, intervalMs);
    }
  };

  timer = setTimeout(tick, intervalMs);

  return () => {
    running = false;
    if (timer) clearTimeout(timer);
  };
}
```

Test:

```ts
it('marks run as TIMED_OUT when past deadline', async () => {
  // Create workflow with timeout 1 sec
  // Create run, mark as RUNNING with started_at 2 sec ago
  await scanTimeouts(db);
  const updated = await getRunById(db, ..., runId);
  expect(updated!.status).toBe('TIMED_OUT');
});
```

## Files Involved

- `packages/orchestrator/src/timeout-scanner.ts`
- Test file
- Wire ke `startOrchestrator` di index.ts

## How to Verify

```bash
pnpm -F @flowforge/orchestrator test timeout-scanner
```
