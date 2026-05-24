import { describe, expect, it } from 'vitest';

import { TenantSchema } from './tenant.js';

describe('TenantSchema', () => {
  it('rejects invalid slugs', () => {
    expect(
      TenantSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'Bad Slug',
        name: 'Acme',
        created_at: new Date(),
      }).success,
    ).toBe(false);
  });
});
