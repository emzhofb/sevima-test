import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/003_runs.js');

describe('003_runs migration', () => {
  it('defines runs and step_runs with the required constraints', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("pgm.createTable('runs'");
    expect(migration).toContain("tenant_id: {");
    expect(migration).toContain("references: 'tenants(id)'");
    expect(migration).toContain("workflow_id: {");
    expect(migration).toContain("references: 'workflows(id)'");
    expect(migration).toContain("version_id: {");
    expect(migration).toContain("references: 'workflow_versions(id)'");
    expect(migration).toContain("status: {");
    expect(migration).toContain("status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED','TIMED_OUT')");
    expect(migration).toContain("input: { type: 'jsonb', notNull: true, default: '{}' }");
    expect(migration).toContain("trigger_type IN ('MANUAL','SCHEDULED','WEBHOOK')");
    expect(migration).toContain("idx_runs_tenant_started");

    expect(migration).toContain("pgm.createTable('step_runs'");
    expect(migration).toContain("run_id: {");
    expect(migration).toContain("references: 'runs(id)'");
    expect(migration).toContain("tenant_id: {");
    expect(migration).toContain("step_id: { type: 'varchar(100)', notNull: true }");
    expect(migration).toContain("status IN ('PENDING','READY','RUNNING','SUCCEEDED','FAILED','SKIPPED')");
    expect(migration).toContain("attempt: { type: 'integer', notNull: true, default: 1 }");
    expect(migration).toContain("last_heartbeat_at: { type: 'timestamptz' }");
    expect(migration).toContain("idx_step_runs_run");
    expect(migration).toContain("pgm.dropTable('step_runs');");
    expect(migration).toContain("pgm.dropTable('runs');");
  });
});