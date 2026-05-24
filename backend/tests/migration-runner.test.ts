import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = resolve(backendRoot, 'package.json');
const migrationsReadmePath = resolve(backendRoot, 'migrations/README.md');

describe('migration runner setup', () => {
  it('exposes the expected migration scripts', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      migrate: 'node-pg-migrate',
      'migrate:up': 'node-pg-migrate up',
      'migrate:down': 'node-pg-migrate down',
      'migrate:create': 'node-pg-migrate create',
    });
  });

  it('documents how to create, apply, and rollback migrations', async () => {
    const readme = await readFile(migrationsReadmePath, 'utf8');

    expect(readme).toContain('pnpm migrate:create nama_migration');
    expect(readme).toContain('pnpm migrate:up');
    expect(readme).toContain('pnpm migrate:down');
  });
});
