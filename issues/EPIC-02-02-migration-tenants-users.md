# [Epic-02] Migration: tenants and users tables

**Labels**: `epic-02`, `area-data`
**Estimate**: 2 jam
**Depends on**: #9 (migration runner)

## Context

Tabel pertama untuk multi-tenancy. `tenants` menyimpan organisasi, `users` menyimpan akun yang terikat ke tenant.

## Acceptance Criteria

- [ ] Migration file `001_tenants_users.js` ada
- [ ] Tabel `tenants` punya kolom: `id`, `slug`, `name`, `created_at`
- [ ] Tabel `users` punya kolom: `id`, `tenant_id`, `email`, `password_hash`, `role`, `created_at`
- [ ] Constraint unique: `tenants.slug` global, `users (tenant_id, email)`
- [ ] CHECK constraint `users.role IN ('ADMIN', 'EDITOR', 'VIEWER')`
- [ ] CHECK constraint `tenants.slug` match regex `^[a-z0-9][a-z0-9-]{1,62}$`
- [ ] FK `users.tenant_id` references `tenants(id)` ON DELETE CASCADE
- [ ] `pnpm migrate:up` sukses, `pnpm migrate:down` sukses

## Implementation Hints

`migrations/001_tenants_users.js`:

```js
exports.up = (pgm) => {
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

exports.down = (pgm) => {
  pgm.dropTable('users');
  pgm.dropTable('tenants');
};
```

## Files Involved

- `migrations/001_tenants_users.js`

## How to Verify

```bash
pnpm migrate:up
# Connect ke psql untuk cek
psql $DATABASE_URL -c "\dt"
# Harus tampil: tenants, users, pgmigrations
```
