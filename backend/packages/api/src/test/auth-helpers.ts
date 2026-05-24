import { signJwt, hashPassword } from '@flowforge/auth';
import { createTenant } from '../repos/tenant.repo.js';
import { createUser } from '../repos/user.repo.js';
import type { Db, Tenant, User } from '@flowforge/shared';

export interface TestUserSetup {
  tenant: Tenant;
  user: User;
}

export async function createTestTenantAndUser(
  db: Db,
  options: { slug?: string; email?: string; role?: 'ADMIN' | 'EDITOR' | 'VIEWER' } = {},
): Promise<TestUserSetup> {
  const slug = options.slug ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = options.email ?? `${slug}@test.com`;

  const tenant = await createTenant(db, { slug, name: `Test ${slug}` });

  const passwordHash = await hashPassword('password123');

  const user = await createUser(db, {
    tenant_id: tenant.id,
    email,
    password_hash: passwordHash,
    role: options.role ?? 'EDITOR',
  });

  return { tenant, user };
}

export function buildAuthToken(
  tenantId: string,
  userId: string,
  role: 'ADMIN' | 'EDITOR' | 'VIEWER',
  jwtSecret: string,
): string {
  return signJwt({ tenant_id: tenantId, user_id: userId, role }, jwtSecret);
}
