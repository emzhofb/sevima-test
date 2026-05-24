# [Epic-05] Password hashing with Argon2id

**Labels**: `epic-05`, `area-auth`
**Estimate**: 1 jam
**Depends on**: #38

## Context

Argon2id dengan parameter aman: memory >= 64MB, iterations >= 3. Library `argon2` sudah handle salt otomatis.

## Acceptance Criteria

- [ ] Function `hashPassword(plaintext: string): Promise<string>`
- [ ] Function `verifyPassword(plaintext: string, hash: string): Promise<boolean>`
- [ ] Parameter Argon2id: type=Argon2id, memoryCost=65536 (64MB), timeCost=3, parallelism=1
- [ ] Test: hash + verify roundtrip
- [ ] Test: salah password return false

## Implementation Hints

```ts
// packages/auth/src/password.ts
import argon2 from 'argon2';

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON_OPTIONS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('s3cret-p4ss');
    expect(await verifyPassword('s3cret-p4ss', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('hash format matches argon2id', async () => {
    const hash = await hashPassword('test');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('different passwords produce different hashes', async () => {
    const h1 = await hashPassword('test');
    const h2 = await hashPassword('test'); // same plaintext, different salt
    expect(h1).not.toBe(h2);
    expect(await verifyPassword('test', h1)).toBe(true);
    expect(await verifyPassword('test', h2)).toBe(true);
  });
});
```

## Files Involved

- `packages/auth/src/password.ts`
- `packages/auth/src/password.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/auth test password
```
