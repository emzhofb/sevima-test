# [Epic-06] Audit log repository

**Labels**: `epic-06`, `good-first-issue`, `area-data`
**Estimate**: 0.5 jam
**Depends on**: #15 (audit migration)

## Context

Helper untuk write ke `audit_logs`. Append-only di app layer (tidak ada update/delete fn).

## Acceptance Criteria

- [ ] Function `writeAuditLog(db, entry)`
- [ ] Function `listAuditLogs(db, tenantId, { page, pageSize })`
- [ ] Tidak ada `updateAuditLog` atau `deleteAuditLog`

## Implementation Hints

```ts
// packages/api/src/repos/audit.repo.ts
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
  entry: Omit<AuditLogEntry, 'id' | 'created_at'> & { metadata?: Record<string, unknown> },
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

  return { items: items.rows, total: Number(total.rows[0].count) };
}
```

## Files Involved

- `packages/api/src/repos/audit.repo.ts`
- `packages/api/src/repos/audit.repo.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test repos/audit
```
