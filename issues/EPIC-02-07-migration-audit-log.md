# [Epic-02] Migration: audit_logs table

**Labels**: `epic-02`, `area-data`
**Estimate**: 0.5 jam
**Depends on**: #10

## Context

Audit log untuk mutasi sensitif (workflow create/update/delete, run trigger, role change).

## Acceptance Criteria

- [ ] Migration `006_audit_logs.js`
- [ ] Tabel `audit_logs`: `id`, `tenant_id`, `user_id`, `action`, `resource_type`, `resource_id`, `request_id`, `metadata (jsonb)`, `created_at`
- [ ] Index `(tenant_id, created_at DESC)`
- [ ] Tidak ada UPDATE atau DELETE permission (enforce di app layer)

## Implementation Hints

```js
exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)' },
    user_id: { type: 'uuid', references: 'users(id)' },
    action: { type: 'varchar(50)', notNull: true },
    resource_type: { type: 'varchar(50)', notNull: true },
    resource_id: { type: 'varchar(100)' },
    request_id: { type: 'varchar(100)' },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('audit_logs', [{ name: 'tenant_id' }, { name: 'created_at', sort: 'DESC' }]);
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs');
};
```

## Files Involved

- `migrations/006_audit_logs.js`

## How to Verify

```bash
pnpm migrate:up
psql $DATABASE_URL -c "\d audit_logs"
```
