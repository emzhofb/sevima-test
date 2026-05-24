import { describe, expect, it } from 'vitest';

import { UserSchema } from './user.js';

describe('UserSchema', () => {
  it('rejects unknown roles', () => {
    expect(
      UserSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'user@example.com',
        password_hash: 'hash',
        role: 'OWNER',
        created_at: new Date(),
      }).success,
    ).toBe(false);
  });
});