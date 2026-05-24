import { computeReadySet } from '@flowforge/parser';
import { withTransaction, publishEvent } from '@flowforge/shared';
import type { Db, DbClient, Broker } from '@flowforge/shared';

export type StepEvent = {
  event_id: string; // unique, used for dedup
  type: 'STEP_SUCCEEDED' | 'STEP_FAILED';
  run_id: string;
  step_id: string;
  output?: unknown;
  error?: string;
  attempt: number;
};

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);

export async function handleStepEvent(db: Db, broker: Broker, event: StepEvent): Promise<void> {
  await withTransaction(db, async (client: DbClient) => {
    // Dedup: insert event_id into processed_events, skip if already exists
    const dedup = await client.query(
      `INSERT INTO processed_events (event_id) VALUES ($1)
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [event.event_id],
    );
    if (dedup.rows.length === 0) {
      // Already processed
      return;
    }

    // Lock run
    const runRes = await client.query('SELECT * FROM runs WHERE id = $1 FOR UPDATE', [
      event.run_id,
    ]);
    const run = runRes.rows[0];
    if (!run || TERMINAL_STATUSES.has(run.status)) {
      // Run already terminal or not found, ignore event
      return;
    }

    // Load workflow definition
    const verRes = await client.query('SELECT definition FROM workflow_versions WHERE id = $1', [
      run.version_id,
    ]);
    const definition = verRes.rows[0].definition;
    const stepSpec = definition.steps.find((s: any) => s.id === event.step_id);

    const redis = (broker as any).redis;

    // Update step_run status
    if (event.type === 'STEP_SUCCEEDED') {
      await client.query(
        `UPDATE step_runs SET status = 'SUCCEEDED', output = $1, finished_at = now()
         WHERE run_id = $2 AND step_id = $3`,
        [event.output ?? null, event.run_id, event.step_id],
      );
      if (redis) {
        await publishEvent(redis, {
          tenant_id: run.tenant_id,
          run_id: event.run_id,
          step_id: event.step_id,
          type: 'STEP_SUCCEEDED',
          ts: Date.now(),
          payload: event.output,
        }).catch(() => {});
      }
    } else {
      // STEP_FAILED
      await client.query(
        `UPDATE step_runs SET status = 'FAILED', error = $1, finished_at = now()
         WHERE run_id = $2 AND step_id = $3`,
        [event.error ?? null, event.run_id, event.step_id],
      );
      if (redis) {
        await publishEvent(redis, {
          tenant_id: run.tenant_id,
          run_id: event.run_id,
          step_id: event.step_id,
          type: 'STEP_FAILED',
          ts: Date.now(),
          payload: { error: event.error },
        }).catch(() => {});
      }
    }

    // Check if run should fail (step failed and not continue_on_failure)
    if (event.type === 'STEP_FAILED' && !stepSpec?.continue_on_failure) {
      await client.query(`UPDATE runs SET status = 'FAILED', finished_at = now() WHERE id = $1`, [
        event.run_id,
      ]);
      if (redis) {
        await publishEvent(redis, {
          tenant_id: run.tenant_id,
          run_id: event.run_id,
          type: 'RUN_FAILED',
          ts: Date.now(),
          payload: { error: event.error },
        }).catch(() => {});
      }
      return;
    }

    // Compute current completed set
    const completedRes = await client.query(
      `SELECT step_id FROM step_runs
       WHERE run_id = $1 AND status IN ('SUCCEEDED','SKIPPED','FAILED')`,
      [event.run_id],
    );
    const completed = new Set<string>(completedRes.rows.map((r: any) => r.step_id));

    const ready = computeReadySet(definition, completed);
    const allStepIds = new Set<string>(definition.steps.map((s: any) => s.id));

    if (ready.size === 0 && completed.size === allStepIds.size) {
      // All steps done, mark run SUCCEEDED
      await client.query(
        `UPDATE runs SET status = 'SUCCEEDED', finished_at = now() WHERE id = $1`,
        [event.run_id],
      );
      if (redis) {
        await publishEvent(redis, {
          tenant_id: run.tenant_id,
          run_id: event.run_id,
          type: 'RUN_SUCCEEDED',
          ts: Date.now(),
        }).catch(() => {});
      }
      return;
    }

    // Enqueue ready steps that haven't been enqueued yet
    for (const stepId of ready) {
      const existing = await client.query(
        'SELECT status FROM step_runs WHERE run_id = $1 AND step_id = $2',
        [event.run_id, stepId],
      );
      if (existing.rows.length > 0) continue; // Already created

      await client.query(
        `INSERT INTO step_runs (run_id, tenant_id, step_id, status, attempt)
         VALUES ($1, $2, $3, 'READY', 1)`,
        [event.run_id, run.tenant_id, stepId],
      );

      await broker.enqueue('flowforge:steps', {
        run_id: event.run_id,
        step_id: stepId,
        tenant_id: run.tenant_id,
        attempt: '1',
      });
    }
  });
}
