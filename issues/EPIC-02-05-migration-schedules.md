# [Epic-02] Migration: schedules table

**Labels**: `epic-02`, `area-data`
**Estimate**: 0.5 jam
**Depends on**: #12

## Context

Untuk cron-based workflow trigger.

## Acceptance Criteria

- [ ] Migration `004_schedules.js`
- [ ] Tabel `schedules`: `id`, `workflow_id`, `tenant_id`, `cron_expr`, `tz`, `next_run_at`, `enabled`, `created_at`
- [ ] Partial index `idx_schedules_due (next_run_at) WHERE enabled = true`

## Implementation Hints

```js
exports.up = (pgm) => {
  pgm.createTable('schedules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    workflow_id: { type: 'uuid', notNull: true, references: 'workflows(id)', onDelete: 'CASCADE' },
    cron_expr: { type: 'varchar(100)', notNull: true },
    tz: { type: 'varchar(50)', notNull: true, default: 'UTC' },
    next_run_at: { type: 'timestamptz', notNull: true },
    enabled: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.sql(`
    CREATE INDEX idx_schedules_due
    ON schedules (next_run_at)
    WHERE enabled = true
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('schedules');
};
```

## Files Involved

- `migrations/004_schedules.js`

## How to Verify

```bash
pnpm migrate:up
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'schedules';"
```
