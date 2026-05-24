import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = resolve(backendRoot, 'migrations/007_processed_events.js');

describe('007_processed_events migration', () => {
  it('defines processed_events for event deduplication', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("pgm.createTable('processed_events'");
    expect(migration).toContain("event_id: { type: 'varchar(100)', primaryKey: true }");
    expect(migration).toContain(
      "processed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }",
    );
    expect(migration).toContain("pgm.createIndex('processed_events', 'processed_at');");
    expect(migration).toContain("pgm.dropTable('processed_events');");
  });
});
