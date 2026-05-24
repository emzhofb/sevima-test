import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/006_audit_logs.js');

describe('006_audit_logs migration', () => {
  it('defines audit_logs with the required index', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("pgm.createTable('audit_logs'");
    expect(migration).toContain(
      "tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)' }",
    );
    expect(migration).toContain("user_id: { type: 'uuid', references: 'users(id)' }");
    expect(migration).toContain("metadata: { type: 'jsonb', notNull: true, default: '{}' }");
    expect(migration).toContain(
      "pgm.createIndex('audit_logs', [{ name: 'tenant_id' }, { name: 'created_at', sort: 'DESC' }]);",
    );
    expect(migration).toContain("pgm.dropTable('audit_logs');");
  });
});
