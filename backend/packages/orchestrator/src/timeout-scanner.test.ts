import { describe, it, expect, vi } from 'vitest';
import { scanTimeouts } from './timeout-scanner.js';

describe('scanTimeouts', () => {
  it('marks timed-out runs as TIMED_OUT and returns count', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 'run-1' }, { id: 'run-2' }], rowCount: 2 }),
    };

    const count = await scanTimeouts(mockDb as any);
    expect(count).toBe(2);
    expect(mockDb.query).toHaveBeenCalledOnce();
    const [sql] = mockDb.query.mock.calls[0] as [string];
    expect(sql).toContain("TIMED_OUT");
  });

  it('returns 0 when no runs are timed out', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    const count = await scanTimeouts(mockDb as any);
    expect(count).toBe(0);
  });

  it('handles null rowCount gracefully', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: null }),
    };

    const count = await scanTimeouts(mockDb as any);
    expect(count).toBe(0);
  });
});
