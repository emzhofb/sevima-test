import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/002_workflows.js');

describe('002_workflows migration', () => {
  it('defines workflows and workflow_versions with the required constraints', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("pgm.createTable('workflows'");
    expect(migration).toContain("tenant_id: {");
    expect(migration).toContain("references: 'tenants(id)'");
    expect(migration).toContain("onDelete: 'CASCADE'");
    expect(migration).toContain("current_version: { type: 'integer', notNull: true, default: 1 }");
    expect(migration).toContain("updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }");

    expect(migration).toContain("pgm.createTable('workflow_versions'");
    expect(migration).toContain("workflow_id: {");
    expect(migration).toContain("references: 'workflows(id)'");
    expect(migration).toContain("version: { type: 'integer', notNull: true }");
    expect(migration).toContain("definition: { type: 'jsonb', notNull: true }");
    expect(migration).toContain("created_by: {");
    expect(migration).toContain("references: 'users(id)'");
    expect(migration).toContain("pgm.createIndex('workflow_versions', ['workflow_id', 'version'], { unique: true });");
    expect(migration).toContain("name: 'idx_workflow_versions_wf'");
    expect(migration).toContain("name: 'idx_workflows_tenant_updated'");
    expect(migration).toContain("pgm.dropTable('workflow_versions');");
    expect(migration).toContain("pgm.dropTable('workflows');");
  });
});