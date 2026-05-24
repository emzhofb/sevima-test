import type { Db } from '@flowforge/shared';

export async function scanTimeouts(db: Db): Promise<number> {
  // Find RUNNING runs that have exceeded their workflow's timeout_sec
  const result = await db.query(
    `WITH timed_out AS (
       SELECT r.id
       FROM runs r
       JOIN workflow_versions v ON v.id = r.version_id
       WHERE r.status = 'RUNNING'
         AND r.started_at IS NOT NULL
         AND (v.definition->>'timeout_sec')::int IS NOT NULL
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
      await scanTimeouts(db);
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
