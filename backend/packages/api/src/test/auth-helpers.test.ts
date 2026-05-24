import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestTenantAndUser, buildAuthToken } from './auth-helpers.js';

describe('auth-helpers', () => {
  let mockDb: any;

  beforeEach(() => {
    let tenantId = 0;
    let userId = 0;

    mockDb = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO tenants')) {
          const id = `tenant-${++tenantId}`;
          return {
            rows: [
              {
                id,
                slug: params?.[0],
                name: params?.[1],
                created_at: new Date(),
              },
            ],
          };
        }

        if (sql.includes('INSERT INTO users')) {
          const id = `user-${++userId}`;
          return {
            rows: [
              {
                id,
                tenant_id: params?.[0],
                email: params?.[1],
                password_hash: params?.[2],
                role: params?.[3],
                created_at: new Date(),
              },
            ],
          };
        }

        return { rows: [] };
      }),
    };
  });

  it('createTestTenantAndUser creates tenant and user', async () => {
    const result = await createTestTenantAndUser(mockDb);

    expect(result.tenant).toBeDefined();
    expect(result.tenant.slug).toMatch(/^test-/);
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(`${result.tenant.slug}@test.com`);
    expect(result.user.role).toBe('EDITOR');
  });

  it('createTestTenantAndUser accepts custom slug', async () => {
    const result = await createTestTenantAndUser(mockDb, { slug: 'custom-slug' });

    expect(result.tenant.slug).toBe('custom-slug');
    expect(result.user.email).toBe('custom-slug@test.com');
  });

  it('createTestTenantAndUser accepts custom email', async () => {
    const result = await createTestTenantAndUser(mockDb, { email: 'custom@example.com' });

    expect(result.user.email).toBe('custom@example.com');
  });

  it('createTestTenantAndUser accepts custom role', async () => {
    const result = await createTestTenantAndUser(mockDb, { role: 'ADMIN' });

    expect(result.user.role).toBe('ADMIN');
  });

  it('buildAuthToken creates valid JWT', () => {
    const jwtSecret = 'test-secret-key';
    const tenantId = 'tenant-123';
    const userId = 'user-456';
    const role = 'EDITOR';

    const token = buildAuthToken(tenantId, userId, role, jwtSecret);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
  });

  it('buildAuthToken creates different tokens for different roles', () => {
    const jwtSecret = 'test-secret-key';
    const tenantId = 'tenant-123';
    const userId = 'user-456';

    const editorToken = buildAuthToken(tenantId, userId, 'EDITOR', jwtSecret);
    const adminToken = buildAuthToken(tenantId, userId, 'ADMIN', jwtSecret);

    expect(editorToken).not.toBe(adminToken);
  });

  it('creates test user with hashed password', async () => {
    const result = await createTestTenantAndUser(mockDb);

    expect(result.user.password_hash).toBeDefined();
    // Password hash should not be the plain text
    expect(result.user.password_hash).not.toBe('password123');
    // Argon2id hashes start with $argon2id$
    expect(result.user.password_hash).toMatch(/^\$argon2id\$/);
  });
});
