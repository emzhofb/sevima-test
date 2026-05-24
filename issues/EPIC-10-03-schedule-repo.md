# [Epic-10] Schedule repository

**Labels**: `epic-10`, `good-first-issue`, `area-data`
**Estimate**: 1 jam
**Depends on**: #13 (schedules migration)

## Context

CRUD untuk `schedules` table.

## Acceptance Criteria

- [ ] Functions: `createSchedule`, `getScheduleById`, `listSchedules`, `updateSchedule`, `deleteSchedule`
- [ ] Tenant-scoped

## Implementation Hints

```ts
// packages/api/src/repos/schedule.repo.ts
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
  input: { tenant_id: string; workflow_id: string; cron_expr: string; tz: string; next_run_at: Date; enabled: boolean },
): Promise<Schedule> {
  const result = await db.query<Schedule>(
    `INSERT INTO schedules (tenant_id, workflow_id, cron_expr, tz, next_run_at, enabled)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.tenant_id, input.workflow_id, input.cron_expr, input.tz, input.next_run_at, input.enabled],
  );
  return result.rows[0];
}

export async function listSchedules(db: Db, tenantId: string, workflowId?: string): Promise<Schedule[]> {
  if (workflowId) {
    return (await db.query<Schedule>(
      'SELECT * FROM schedules WHERE tenant_id = $1 AND workflow_id = $2 ORDER BY created_at DESC',
      [tenantId, workflowId],
    )).rows;
  }
  return (await db.query<Schedule>(
    'SELECT * FROM schedules WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId],
  )).rows;
}

export async function updateSchedule(
  db: Db, tenantId: string, id: string, input: Partial<{ enabled: boolean; cron_expr: string; tz: string; next_run_at: Date }>,
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
  const result = await db.query(
    'DELETE FROM schedules WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
```

## Files Involved

- `packages/api/src/repos/schedule.repo.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test repos/schedule
```
