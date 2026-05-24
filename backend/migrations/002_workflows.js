export const up = (pgm) => {
  pgm.createTable('workflows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(200)', notNull: true },
    current_version: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('workflow_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    workflow_id: {
      type: 'uuid',
      notNull: true,
      references: 'workflows(id)',
      onDelete: 'CASCADE',
    },
    version: { type: 'integer', notNull: true },
    definition: { type: 'jsonb', notNull: true },
    created_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('workflow_versions', ['workflow_id', 'version'], { unique: true });
  pgm.createIndex(
    'workflow_versions',
    [{ name: 'workflow_id' }, { name: 'version', sort: 'DESC' }],
    {
      name: 'idx_workflow_versions_wf',
    },
  );
  pgm.createIndex('workflows', [{ name: 'tenant_id' }, { name: 'updated_at', sort: 'DESC' }], {
    name: 'idx_workflows_tenant_updated',
  });
};

export const down = (pgm) => {
  pgm.dropTable('workflow_versions');
  pgm.dropTable('workflows');
};
