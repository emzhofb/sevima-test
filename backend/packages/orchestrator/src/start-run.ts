import { computeReadySet } from '@flowforge/parser';
import { withTransaction, publishEvent } from '@flowforge/shared';
import type { Db, Broker } from '@flowforge/shared';

export async function startRun(db: Db, broker: Broker, runId: string): Promise<void> {
  await withTransaction(db, async (client) => {
    // Lock + load run
    const runRes = await client.query('SELECT * FROM runs WHERE id = $1 FOR UPDATE', [runId]);
    const run = runRes.rows[0];
    if (!run) throw new Error(`Run ${runId} not found`);

    if (run.status !== 'PENDING') {
      // Already started, skip (idempotent)
      return;
    }

    // Load definition from version
    const versionRes = await client.query(
      'SELECT definition FROM workflow_versions WHERE id = $1',
      [run.version_id],
    );
    const definition = versionRes.rows[0].definition;

    // Transition to RUNNING
    await client.query(`UPDATE runs SET status = 'RUNNING', started_at = now() WHERE id = $1`, [
      runId,
    ]);

    const redis = (broker as any).redis;
    if (redis) {
      await publishEvent(redis, {
        tenant_id: run.tenant_id,
        run_id: runId,
        type: 'RUN_STARTED',
        ts: Date.now(),
      }).catch(() => {});
    }

    // Compute initial ready set (steps with no dependencies)
    const ready = computeReadySet(definition, new Set());

    // Insert step_runs as READY for ready set
    for (const stepId of ready) {
      await client.query(
        `INSERT INTO step_runs (run_id, tenant_id, step_id, status, attempt)
         VALUES ($1, $2, $3, 'READY', 1)
         ON CONFLICT DO NOTHING`,
        [runId, run.tenant_id, stepId],
      );
    }

    // Enqueue ready steps to broker
    for (const stepId of ready) {
      await broker.enqueue('flowforge:steps', {
        run_id: runId,
        step_id: stepId,
        tenant_id: run.tenant_id,
        attempt: '1',
      });
    }
  });
}
