import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/001_tenants_users.js');

describe('001_tenants_users migration', () => {
  it('defines the tenants and users tables with the required constraints', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("pgm.createTable('tenants'");
    expect(migration).toContain(
      "id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') }",
    );
    expect(migration).toContain('slug: {');
    expect(migration).toContain('unique: true');
    expect(migration).toContain('check: "slug ~ \'^[a-z0-9][a-z0-9-]{1,62}$\'"');
    expect(migration).toContain("name: { type: 'varchar(200)', notNull: true }");
    expect(migration).toContain(
      "created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }",
    );

    expect(migration).toContain("pgm.createTable('users'");
    expect(migration).toContain('tenant_id: {');
    expect(migration).toContain("references: 'tenants(id)'");
    expect(migration).toContain("onDelete: 'CASCADE'");
    expect(migration).toContain("password_hash: { type: 'text', notNull: true }");
    expect(migration).toContain("check: \"role IN ('ADMIN', 'EDITOR', 'VIEWER')\"");
    expect(migration).toContain(
      "pgm.createIndex('users', ['tenant_id', 'email'], { unique: true });",
    );
    expect(migration).toContain("pgm.dropTable('users');");
    expect(migration).toContain("pgm.dropTable('tenants');");
  });
});
