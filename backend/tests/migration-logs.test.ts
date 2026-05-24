import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/005_logs.js');

describe('005_logs migration', () => {
  it('defines the partitioned logs table and weekly partitions', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE logs');
    expect(migration).toContain('PARTITION BY RANGE (ts)');
    expect(migration).toContain("level varchar(10) NOT NULL CHECK (level IN ('DEBUG','INFO','WARN','ERROR'))");
    expect(migration).toContain("fields jsonb NOT NULL DEFAULT '{}'");
    expect(migration).toContain('CREATE INDEX idx_logs_run_step_ts');
    expect(migration).toContain("ON logs (tenant_id, run_id, step_id, ts)");
    expect(migration).toContain('const weeks = 4;');
    expect(migration).toContain("CREATE TABLE logs_week_${i} PARTITION OF logs");
    expect(migration).toContain("FOR VALUES FROM (date_trunc('week', now() + interval '${i} week'))");
    expect(migration).toContain("DROP TABLE IF EXISTS logs CASCADE;");
  });
});