import { describe, expect, it, vi } from 'vitest';

import { createUser, findUserForLogin, getUserByEmail, getUserById } from './user.repo.js';

describe('user.repo', () => {
  it('creates and looks up users by tenant scope', async () => {
    const user = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      password_hash: 'hash',
      role: 'EDITOR' as const,
      created_at: new Date('2026-05-24T00:00:00.000Z'),
    };

    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT')) {
        return { rows: [user] };
      }

      return { rows: [user] };
    });

    const db = { query };

    const created = await createUser(db as never, {
      tenant_id: user.tenant_id,
      email: user.email,
      password_hash: user.password_hash,
      role: user.role,
    });
    const byEmail = await getUserByEmail(db as never, user.tenant_id, user.email);
    const byId = await getUserById(db as never, user.tenant_id, user.id);
    const loginUser = await findUserForLogin(db as never, 'acme', user.email);

    expect(created.id).toBe(user.id);
    expect(byEmail?.email).toBe(user.email);
    expect(byId?.id).toBe(user.id);
    expect(loginUser?.email).toBe(user.email);
    expect(query).toHaveBeenCalledWith(
      `INSERT INTO users (tenant_id, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
      [user.tenant_id, user.email, user.password_hash, user.role],
    );
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE tenant_id = $1 AND email = $2', [
      user.tenant_id,
      user.email,
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE tenant_id = $1 AND id = $2', [
      user.tenant_id,
      user.id,
    ]);
    expect(query).toHaveBeenCalledWith(
      `SELECT u.* FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE t.slug = $1 AND u.email = $2`,
      ['acme', user.email],
    );
  });
});
