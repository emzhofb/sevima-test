import { describe, it, expect, vi } from 'vitest';
import { schedulerTick } from './tick.js';

// Mock cron-parser
vi.mock('cron-parser', () => ({
  default: {
    parseExpression: vi.fn().mockReturnValue({
      next: () => ({ toDate: () => new Date('2099-01-01T00:05:00Z') }),
    }),
  },
}));

function makeDb(schedules: any[] = []) {
  let txClient: any;

  const clientQuery = vi.fn(async (sql: string, _params?: unknown[]) => {
    // SELECT due schedules
    if (sql.includes('FROM schedules') && sql.includes('SKIP LOCKED')) {
      return { rows: schedules };
    }
    // INSERT run
    if (sql.includes('INSERT INTO runs')) {
      return { rows: [{ id: 'run-generated-id' }] };
    }
    // UPDATE next_run_at
    if (sql.includes('UPDATE schedules SET next_run_at')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [] };
  });

  txClient = {
    query: clientQuery,
    release: vi.fn(),
  };

  const mockDb = {
    query: clientQuery,
    connect: vi.fn(async () => txClient),
  };

  return { mockDb, clientQuery };
}

describe('schedulerTick', () => {
  it('returns 0 when no schedules are due', async () => {
    const { mockDb } = makeDb([]);
    const mockBroker = {
      enqueue: vi.fn().mockResolvedValue('id'),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    const triggered = await schedulerTick(mockDb as any, mockBroker as any);
    expect(triggered).toBe(0);
    expect(mockBroker.enqueue).not.toHaveBeenCalled();
  });

  it('triggers run and advances next_run_at for a due schedule', async () => {
    const schedule = {
      id: 'sched-1',
      tenant_id: 'tenant-1',
      workflow_id: 'wf-1',
      version_id: 'ver-1',
      cron_expr: '*/5 * * * *',
      tz: 'UTC',
      enabled: true,
    };
    const { mockDb, clientQuery } = makeDb([schedule]);
    const mockBroker = {
      enqueue: vi.fn().mockResolvedValue('id'),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    const triggered = await schedulerTick(mockDb as any, mockBroker as any);

    expect(triggered).toBe(1);
    expect(mockBroker.enqueue).toHaveBeenCalledWith(
      'flowforge:runs',
      expect.objectContaining({
        run_id: 'run-generated-id',
        tenant_id: 'tenant-1',
      }),
    );

    // Verify next_run_at was updated
    const updateCall = clientQuery.mock.calls.find((c: any[]) =>
      (c[0] as string).includes('UPDATE schedules SET next_run_at'),
    );
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]?.[1]).toBe('sched-1');
  });

  it('triggers multiple due schedules', async () => {
    const schedules = [
      {
        id: 'sched-1',
        tenant_id: 't1',
        workflow_id: 'wf-1',
        version_id: 'v1',
        cron_expr: '*/5 * * * *',
        tz: 'UTC',
        enabled: true,
      },
      {
        id: 'sched-2',
        tenant_id: 't2',
        workflow_id: 'wf-2',
        version_id: 'v2',
        cron_expr: '0 * * * *',
        tz: 'UTC',
        enabled: true,
      },
    ];
    const { mockDb } = makeDb(schedules);
    const mockBroker = {
      enqueue: vi.fn().mockResolvedValue('id'),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    const triggered = await schedulerTick(mockDb as any, mockBroker as any);

    expect(triggered).toBe(2);
    expect(mockBroker.enqueue).toHaveBeenCalledTimes(2);
  });
});
