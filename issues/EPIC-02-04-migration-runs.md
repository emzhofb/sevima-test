# [Epic-02] Migration: runs and step_runs tables

**Labels**: `epic-02`, `area-data`
**Estimate**: 1.5 jam
**Depends on**: #11 (workflows migration)

## Context

`runs` mencatat setiap eksekusi workflow, `step_runs` mencatat eksekusi individual step.

## Acceptance Criteria

- [ ] Migration `003_runs.js`
- [ ] Tabel `runs`: `id`, `tenant_id`, `workflow_id`, `version_id`, `status`, `input (jsonb)`, `started_at`, `finished_at`, `trigger_type`
- [ ] Tabel `step_runs`: `id`, `run_id`, `tenant_id`, `step_id`, `status`, `attempt`, `output (jsonb)`, `error`, `started_at`, `finished_at`, `last_heartbeat_at`
- [ ] CHECK status valid: runs `('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED','TIMED_OUT')`, step_runs `('PENDING','READY','RUNNING','SUCCEEDED','FAILED','SKIPPED')`
- [ ] CHECK `trigger_type IN ('MANUAL','SCHEDULED','WEBHOOK')`
- [ ] Index `idx_runs_tenant_started (tenant_id, started_at DESC)`
- [ ] Index `idx_step_runs_run (run_id, step_id)`

## Implementation Hints

```js
exports.up = (pgm) => {
  pgm.createTable('runs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    workflow_id: { type: 'uuid', notNull: true, references: 'workflows(id)', onDelete: 'CASCADE' },
    version_id: { type: 'uuid', notNull: true, references: 'workflow_versions(id)' },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED','TIMED_OUT')",
    },
    input: { type: 'jsonb', notNull: true, default: '{}' },
    trigger_type: {
      type: 'varchar(20)',
      notNull: true,
      check: "trigger_type IN ('MANUAL','SCHEDULED','WEBHOOK')",
    },
    started_at: { type: 'timestamptz' },
    finished_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('step_runs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    run_id: { type: 'uuid', notNull: true, references: 'runs(id)', onDelete: 'CASCADE' },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    step_id: { type: 'varchar(100)', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING','READY','RUNNING','SUCCEEDED','FAILED','SKIPPED')",
    },
    attempt: { type: 'integer', notNull: true, default: 1 },
    output: { type: 'jsonb' },
    error: { type: 'text' },
    started_at: { type: 'timestamptz' },
    finished_at: { type: 'timestamptz' },
    last_heartbeat_at: { type: 'timestamptz' },
  });

  pgm.createIndex('step_runs', ['run_id', 'step_id'], {
    name: 'idx_step_runs_run',
    unique: true,
  });
  pgm.createIndex('runs', [{ name: 'tenant_id' }, { name: 'started_at', sort: 'DESC' }], {
    name: 'idx_runs_tenant_started',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('step_runs');
  pgm.dropTable('runs');
};
```

## Files Involved

- `migrations/003_runs.js`

## How to Verify

```bash
pnpm migrate:up
psql $DATABASE_URL -c "\d runs"
```
