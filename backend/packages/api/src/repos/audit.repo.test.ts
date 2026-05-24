import { describe, expect, it, vi } from 'vitest';
import { writeAuditLog, listAuditLogs } from './audit.repo.js';

describe('audit.repo', () => {
  it('writes and lists audit logs', async () => {
    const entry = {
      tenant_id: 'tenant-123',
      user_id: 'user-456',
      action: 'workflow.create',
      resource_type: 'workflow',
      resource_id: 'wf-789',
      request_id: 'req-abc',
      metadata: { foo: 'bar' },
    };

    const mockLogs = [
      {
        id: 'log-1',
        ...entry,
        created_at: new Date('2026-05-24T00:00:00.000Z'),
      },
    ];

    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT')) {
        return { rows: [] };
      }
      if (sql.startsWith('SELECT COUNT')) {
        return { rows: [{ count: '1' }] };
      }
      return { rows: mockLogs };
    });

    const db = { query };

    await writeAuditLog(db as any, entry);
    expect(query).toHaveBeenCalledWith(
      `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, request_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.tenant_id,
        entry.user_id,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.request_id,
        entry.metadata,
      ],
    );

    const result = await listAuditLogs(db as any, 'tenant-123', { page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('log-1');
    expect(query).toHaveBeenCalledWith(
      `SELECT * FROM audit_logs WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      ['tenant-123', 20, 0],
    );
  });
});
