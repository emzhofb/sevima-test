import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/004_schedules.js');

describe('004_schedules migration', () => {
  it('defines schedules with the required partial index', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("pgm.createTable('schedules'");
    expect(migration).toContain("tenant_id: {");
    expect(migration).toContain("references: 'tenants(id)'");
    expect(migration).toContain("workflow_id: {");
    expect(migration).toContain("references: 'workflows(id)'");
    expect(migration).toContain("cron_expr: { type: 'varchar(100)', notNull: true }");
    expect(migration).toContain("tz: { type: 'varchar(50)', notNull: true, default: 'UTC' }");
    expect(migration).toContain("enabled: { type: 'boolean', notNull: true, default: true }");
    expect(migration).toContain("CREATE INDEX idx_schedules_due");
    expect(migration).toContain("WHERE enabled = true");
    expect(migration).toContain("pgm.dropTable('schedules');");
  });
});