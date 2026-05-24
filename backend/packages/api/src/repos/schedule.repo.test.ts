import { describe, it, expect, vi } from 'vitest';
import {
  createSchedule,
  getScheduleById,
  listSchedules,
  updateSchedule,
  deleteSchedule,
} from './schedule.repo.js';

const TENANT = 'tenant-1';
const WF_ID = 'wf-1';
const SCHED_ID = 'sched-1';

const mockSchedule = {
  id: SCHED_ID,
  tenant_id: TENANT,
  workflow_id: WF_ID,
  cron_expr: '*/5 * * * *',
  tz: 'UTC',
  next_run_at: new Date('2099-01-01T00:00:00Z'),
  enabled: true,
  created_at: new Date(),
};

function makeDb(returnRow: any = mockSchedule, rowCount = 1) {
  return {
    query: vi.fn().mockResolvedValue({ rows: [returnRow], rowCount }),
  };
}

describe('schedule.repo', () => {
  it('createSchedule inserts and returns schedule', async () => {
    const db = makeDb();
    const result = await createSchedule(db as any, {
      tenant_id: TENANT,
      workflow_id: WF_ID,
      cron_expr: '*/5 * * * *',
      tz: 'UTC',
      next_run_at: new Date('2099-01-01T00:00:00Z'),
      enabled: true,
    });
    expect(result.id).toBe(SCHED_ID);
    expect(db.query).toHaveBeenCalledOnce();
    const [sql] = db.query.mock.calls[0] as [string];
    expect(sql).toContain('INSERT INTO schedules');
  });

  it('getScheduleById returns schedule for correct tenant', async () => {
    const db = makeDb();
    const result = await getScheduleById(db as any, TENANT, SCHED_ID);
    expect(result?.id).toBe(SCHED_ID);
  });

  it('getScheduleById returns null when not found', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const result = await getScheduleById(db as any, TENANT, 'nonexistent');
    expect(result).toBeNull();
  });

  it('listSchedules returns all schedules for tenant', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [mockSchedule] }) };
    const result = await listSchedules(db as any, TENANT);
    expect(result).toHaveLength(1);
  });

  it('listSchedules filters by workflowId when provided', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [mockSchedule] }) };
    await listSchedules(db as any, TENANT, WF_ID);
    const [sql] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('workflow_id = $2');
  });

  it('updateSchedule returns null when no fields provided', async () => {
    const db = makeDb();
    const result = await updateSchedule(db as any, TENANT, SCHED_ID, {});
    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('updateSchedule patches enabled field', async () => {
    const db = makeDb({ ...mockSchedule, enabled: false });
    const result = await updateSchedule(db as any, TENANT, SCHED_ID, { enabled: false });
    expect(result?.enabled).toBe(false);
    const [sql] = db.query.mock.calls[0] as [string];
    expect(sql).toContain('enabled = $3');
  });

  it('deleteSchedule returns true on success', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const result = await deleteSchedule(db as any, TENANT, SCHED_ID);
    expect(result).toBe(true);
  });

  it('deleteSchedule returns false when not found', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    const result = await deleteSchedule(db as any, TENANT, 'nonexistent');
    expect(result).toBe(false);
  });
});
