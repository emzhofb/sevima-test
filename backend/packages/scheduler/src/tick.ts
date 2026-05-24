import cronParser from 'cron-parser';
import { withTransaction } from '@flowforge/shared';
import type { Db, DbClient, Broker } from '@flowforge/shared';

/**
 * Single-replica scheduler tick.
 * Uses FOR UPDATE SKIP LOCKED for safe concurrent access.
 *
 * Note: Multi-replica deployment requires advisory locks (future work).
 */
export async function schedulerTick(db: Db, broker: Broker): Promise<number> {
  let triggered = 0;

  await withTransaction(db, async (client: DbClient) => {
    // Find due schedules — lock rows to prevent double-firing
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
      // Insert new run
      const runRes = await client.query(
        `INSERT INTO runs (tenant_id, workflow_id, version_id, trigger_type, input, status)
         VALUES ($1, $2, $3, 'SCHEDULED', '{}', 'PENDING')
         RETURNING id`,
        [schedule.tenant_id, schedule.workflow_id, schedule.version_id],
      );
      const runId = runRes.rows[0]?.id as string;

      // Compute next_run_at from cron expression
      const interval = cronParser.parseExpression(schedule.cron_expr, {
        currentDate: new Date(),
        tz: schedule.tz ?? 'UTC',
      });
      const nextAt = interval.next().toDate();

      await client.query('UPDATE schedules SET next_run_at = $1 WHERE id = $2', [
        nextAt,
        schedule.id,
      ]);

      // Enqueue to orchestrator
      await broker.enqueue('flowforge:runs', {
        run_id: runId,
        tenant_id: schedule.tenant_id,
      });

      triggered++;
    }
  });

  return triggered;
}
