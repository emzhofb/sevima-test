export const up = (pgm) => {
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

export const down = (pgm) => {
  pgm.dropTable('audit_logs');
};
