export const up = (pgm) => {
  pgm.createTable('schedules', {
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

export const down = (pgm) => {
  pgm.dropTable('schedules');
};