export const up = (pgm) => {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    slug: {
      type: 'varchar(63)',
      notNull: true,
      unique: true,
      check: "slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'",
    },
    name: { type: 'varchar(200)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    email: { type: 'varchar(255)', notNull: true },
    password_hash: { type: 'text', notNull: true },
    role: {
      type: 'varchar(20)',
      notNull: true,
      check: "role IN ('ADMIN', 'EDITOR', 'VIEWER')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('users', ['tenant_id', 'email'], { unique: true });
};

export const down = (pgm) => {
  pgm.dropTable('users');
  pgm.dropTable('tenants');
};
