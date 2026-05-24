import type { Db, Tenant } from '@flowforge/shared';

export async function createTenant(
  db: Db,
  input: { slug: string; name: string },
): Promise<Tenant> {
  const result = await db.query<Tenant>(
    'INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING *',
    [input.slug, input.name],
  );

  return result.rows[0];
}

export async function getTenantBySlug(db: Db, slug: string): Promise<Tenant | null> {
  const result = await db.query<Tenant>('SELECT * FROM tenants WHERE slug = $1', [slug]);

  return result.rows[0] ?? null;
}

export async function getTenantById(db: Db, id: string): Promise<Tenant | null> {
  const result = await db.query<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);

  return result.rows[0] ?? null;
}