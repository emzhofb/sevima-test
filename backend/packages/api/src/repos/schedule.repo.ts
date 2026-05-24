import type { Db } from '@flowforge/shared';

export type Schedule = {
  id: string;
  tenant_id: string;
  workflow_id: string;
  cron_expr: string;
  tz: string;
  next_run_at: Date;
  enabled: boolean;
  created_at: Date;
};

export async function createSchedule(
  db: Db,
  input: {
    tenant_id: string;
    workflow_id: string;
    cron_expr: string;
    tz: string;
    next_run_at: Date;
    enabled: boolean;
  },
): Promise<Schedule> {
  const result = await db.query<Schedule>(
    `INSERT INTO schedules (tenant_id, workflow_id, cron_expr, tz, next_run_at, enabled)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.tenant_id,
      input.workflow_id,
      input.cron_expr,
      input.tz,
      input.next_run_at,
      input.enabled,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create schedule');
  return row;
}

export async function getScheduleById(
  db: Db,
  tenantId: string,
  id: string,
): Promise<Schedule | null> {
  const result = await db.query<Schedule>(
    'SELECT * FROM schedules WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return result.rows[0] ?? null;
}

export async function listSchedules(
  db: Db,
  tenantId: string,
  workflowId?: string,
): Promise<Schedule[]> {
  if (workflowId) {
    return (
      await db.query<Schedule>(
        'SELECT * FROM schedules WHERE tenant_id = $1 AND workflow_id = $2 ORDER BY created_at DESC',
        [tenantId, workflowId],
      )
    ).rows;
  }
  return (
    await db.query<Schedule>(
      'SELECT * FROM schedules WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    )
  ).rows;
}

export async function updateSchedule(
  db: Db,
  tenantId: string,
  id: string,
  input: {
    enabled?: boolean | undefined;
    cron_expr?: string | undefined;
    tz?: string | undefined;
    next_run_at?: Date | undefined;
  },
): Promise<Schedule | null> {
  const fields: string[] = [];
  const params: unknown[] = [tenantId, id];
  let idx = 2;

  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) {
      idx++;
      params.push(v);
      fields.push(`${k} = $${idx}`);
    }
  }

  if (fields.length === 0) return null;

  const result = await db.query<Schedule>(
    `UPDATE schedules SET ${fields.join(', ')}
     WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function deleteSchedule(db: Db, tenantId: string, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM schedules WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}
