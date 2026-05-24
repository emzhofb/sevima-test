import { describe, it, expect, vi } from 'vitest';
import { startRun } from './start-run.js';

function makeDb(runStatus: string = 'PENDING', extraQueries?: Record<string, any>) {
  const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FOR UPDATE')) {
      return {
        rows: [
          {
            id: params?.[0],
            tenant_id: 'tenant-1',
            version_id: 'version-1',
            status: runStatus,
          },
        ],
      };
    }
    if (sql.includes('SELECT definition')) {
      return {
        rows: [
          {
            definition: {
              steps: [
                { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } },
                { id: 'b', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } },
                { id: 'c', type: 'DELAY', depends_on: ['a', 'b'], config: { duration_ms: 100 } },
              ],
            },
          },
        ],
      };
    }
    return { rows: [] };
  });

  const mockDb = {
    query: clientQuery,
    connect: vi.fn(async () => ({
      query: clientQuery,
      release: vi.fn(),
    })),
  };

  return { mockDb, clientQuery };
}

describe('startRun', () => {
  it('transitions run to RUNNING and enqueues initial ready steps', async () => {
    const { mockDb } = makeDb('PENDING');
    const enqueued: any[] = [];
    const mockBroker = {
      enqueue: vi.fn(async (_stream: string, payload: any) => {
        enqueued.push(payload);
        return 'id';
      }),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    await startRun(mockDb as any, mockBroker as any, 'run-1');

    // 'a' and 'b' are root steps (no deps), 'c' depends on both
    expect(enqueued.length).toBe(2);
    const stepIds = enqueued.map((e) => e.step_id).sort();
    expect(stepIds).toEqual(['a', 'b']);
  });

  it('is idempotent: second call on non-PENDING run is a no-op', async () => {
    const { mockDb } = makeDb('RUNNING');
    const mockBroker = {
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    await startRun(mockDb as any, mockBroker as any, 'run-1');

    // Should not enqueue anything since run is already RUNNING
    expect(mockBroker.enqueue).not.toHaveBeenCalled();
  });

  it('throws if run is not found', async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rows: [] };
      return { rows: [] };
    });
    const mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };
    const mockBroker = {
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    await expect(startRun(mockDb as any, mockBroker as any, 'nonexistent')).rejects.toThrow(
      'not found',
    );
  });
});
