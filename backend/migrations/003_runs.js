export const up = (pgm) => {
  pgm.createTable('runs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    workflow_id: {
      type: 'uuid',
      notNull: true,
      references: 'workflows(id)',
      onDelete: 'CASCADE',
    },
    version_id: {
      type: 'uuid',
      notNull: true,
      references: 'workflow_versions(id)',
    },
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
    run_id: {
      type: 'uuid',
      notNull: true,
      references: 'runs(id)',
      onDelete: 'CASCADE',
    },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
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
  });
  pgm.createIndex('runs', [{ name: 'tenant_id' }, { name: 'started_at', sort: 'DESC' }], {
    name: 'idx_runs_tenant_started',
  });
};

export const down = (pgm) => {
  pgm.dropTable('step_runs');
  pgm.dropTable('runs');
};
