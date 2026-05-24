# [Epic-02] Migration: workflows and workflow_versions tables

**Labels**: `epic-02`, `area-data`
**Estimate**: 1.5 jam
**Depends on**: #10

## Context

`workflows` adalah header (nama, current version), `workflow_versions` adalah snapshot definisi. Setiap update bikin versi baru, versi lama tidak diubah.

## Acceptance Criteria

- [ ] Migration `002_workflows.js`
- [ ] Tabel `workflows`: `id`, `tenant_id`, `name`, `current_version`, `created_at`, `updated_at`
- [ ] Tabel `workflow_versions`: `id`, `workflow_id`, `version`, `definition (jsonb)`, `created_by`, `created_at`
- [ ] Unique constraint `(workflow_id, version)`
- [ ] FK semua benar dengan ON DELETE CASCADE
- [ ] Index `idx_workflows_tenant_updated (tenant_id, updated_at DESC)`
- [ ] Index `idx_workflow_versions_wf (workflow_id, version DESC)`

## Implementation Hints

```js
exports.up = (pgm) => {
  pgm.createTable('workflows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(200)', notNull: true },
    current_version: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('workflow_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    workflow_id: { type: 'uuid', notNull: true, references: 'workflows(id)', onDelete: 'CASCADE' },
    version: { type: 'integer', notNull: true },
    definition: { type: 'jsonb', notNull: true },
    created_by: { type: 'uuid', references: 'users(id)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('workflow_versions', ['workflow_id', 'version'], { unique: true });
  pgm.createIndex('workflow_versions', [{ name: 'workflow_id' }, { name: 'version', sort: 'DESC' }], {
    name: 'idx_workflow_versions_wf',
  });
  pgm.createIndex('workflows', [{ name: 'tenant_id' }, { name: 'updated_at', sort: 'DESC' }], {
    name: 'idx_workflows_tenant_updated',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('workflow_versions');
  pgm.dropTable('workflows');
};
```

## Files Involved

- `migrations/002_workflows.js`

## How to Verify

```bash
pnpm migrate:up
psql $DATABASE_URL -c "\d workflows"
psql $DATABASE_URL -c "\d workflow_versions"
```
