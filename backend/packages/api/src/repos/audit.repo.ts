import type { Db } from '@flowforge/shared';

export type AuditLogEntry = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  request_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export async function writeAuditLog(
  db: Db,
  entry: Omit<AuditLogEntry, 'id' | 'created_at' | 'metadata'> & {
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, request_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.tenant_id,
      entry.user_id,
      entry.action,
      entry.resource_type,
      entry.resource_id,
      entry.request_id,
      entry.metadata ?? {},
    ],
  );
}

export async function listAuditLogs(
  db: Db,
  tenantId: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<{ items: AuditLogEntry[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const items = await db.query<AuditLogEntry>(
    `SELECT * FROM audit_logs WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [tenantId, pageSize, offset],
  );
  const total = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM audit_logs WHERE tenant_id = $1',
    [tenantId],
  );

  const totalRow = total.rows[0];
  const totalCount = totalRow ? Number(totalRow.count) : 0;

  return { items: items.rows, total: totalCount };
}
