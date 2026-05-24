import { describe, expect, it, vi } from 'vitest';

import { createTenant, getTenantById, getTenantBySlug } from './tenant.repo.js';

describe('tenant.repo', () => {
  it('creates and retrieves tenants via SQL', async () => {
    const rows = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'acme',
        name: 'Acme Corp',
        created_at: new Date('2026-05-24T00:00:00.000Z'),
      },
    ];

    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT')) {
        return { rows };
      }

      return { rows };
    });

    const db = { query };

    const created = await createTenant(db as never, { slug: 'acme', name: 'Acme Corp' });
    const bySlug = await getTenantBySlug(db as never, 'acme');
    const byId = await getTenantById(db as never, rows[0].id);

    expect(created.slug).toBe('acme');
    expect(bySlug?.name).toBe('Acme Corp');
    expect(byId?.id).toBe(rows[0].id);
    expect(query).toHaveBeenCalledWith(
      'INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING *',
      ['acme', 'Acme Corp'],
    );
    expect(query).toHaveBeenCalledWith('SELECT * FROM tenants WHERE slug = $1', ['acme']);
    expect(query).toHaveBeenCalledWith('SELECT * FROM tenants WHERE id = $1', [rows[0].id]);
  });
});