import type { Db, Role, User } from '@flowforge/shared';

export async function createUser(
  db: Db,
  input: Omit<User, 'id' | 'created_at'>,
): Promise<User> {
  const result = await db.query<User>(
    `INSERT INTO users (tenant_id, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.tenant_id, input.email, input.password_hash, input.role],
  );

  return result.rows[0];
}

export async function getUserByEmail(
  db: Db,
  tenantId: string,
  email: string,
): Promise<User | null> {
  const result = await db.query<User>(
    'SELECT * FROM users WHERE tenant_id = $1 AND email = $2',
    [tenantId, email],
  );

  return result.rows[0] ?? null;
}

export async function getUserById(
  db: Db,
  tenantId: string,
  id: string,
): Promise<User | null> {
  const result = await db.query<User>('SELECT * FROM users WHERE tenant_id = $1 AND id = $2', [tenantId, id]);

  return result.rows[0] ?? null;
}

export async function findUserForLogin(
  db: Db,
  tenantSlug: string,
  email: string,
): Promise<User | null> {
  const result = await db.query<User>(
    `SELECT u.* FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE t.slug = $1 AND u.email = $2`,
    [tenantSlug, email],
  );

  return result.rows[0] ?? null;
}

export type { Role, User } from '@flowforge/shared';