# [Epic-05] JWT sign and verify (HS256 for fresh grad simplicity)

**Labels**: `epic-05`, `area-auth`
**Estimate**: 1.5 jam
**Depends on**: #38

## Context

> Original spec: RS256 dengan key pair. Untuk fresh grad, kita pakai HS256 dengan single secret (lebih simpel, tetap aman untuk MVP). Stretch goal: migrate ke RS256.

JWT claims berisi `tenant_id`, `user_id`, `role`, plus standard `exp`, `iat`.

## Acceptance Criteria

- [ ] Function `signJwt(claims, secret, options)` returns token string
- [ ] Function `verifyJwt(token, secret): JwtClaims | null` (null kalau invalid)
- [ ] Default expiry 15 menit (`exp`)
- [ ] Test: round-trip, expired token, invalid signature

## Implementation Hints

```ts
// packages/auth/src/types.ts
export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type JwtClaims = {
  tenant_id: string;
  user_id: string;
  role: Role;
  iat: number;
  exp: number;
};

export type RequestContext = {
  tenant_id: string;
  user_id: string;
  role: Role;
  request_id: string;
};
```

```ts
// packages/auth/src/jwt.ts
import jwt from 'jsonwebtoken';
import type { JwtClaims, Role } from './types.js';

export function signJwt(
  claims: { tenant_id: string; user_id: string; role: Role },
  secret: string,
  expiresInSec = 900, // 15 minutes
): string {
  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    expiresIn: expiresInSec,
  });
}

export function verifyJwt(token: string, secret: string): JwtClaims | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string') return null;
    return decoded as JwtClaims;
  } catch {
    return null;
  }
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from './jwt.js';

const SECRET = 'test-secret-at-least-32-chars-long-12345';

describe('jwt', () => {
  it('sign and verify round-trip', () => {
    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'EDITOR' }, SECRET);
    const claims = verifyJwt(token, SECRET);
    expect(claims).not.toBeNull();
    expect(claims!.tenant_id).toBe('t1');
    expect(claims!.role).toBe('EDITOR');
  });

  it('returns null on invalid signature', () => {
    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'EDITOR' }, SECRET);
    expect(verifyJwt(token, 'wrong-secret-at-least-32-chars-long-x')).toBeNull();
  });

  it('returns null on expired token', () => {
    const token = signJwt(
      { tenant_id: 't1', user_id: 'u1', role: 'EDITOR' },
      SECRET,
      -1, // expired immediately
    );
    expect(verifyJwt(token, SECRET)).toBeNull();
  });
});
```

## Files Involved

- `packages/auth/src/jwt.ts`
- `packages/auth/src/jwt.test.ts`
- `packages/auth/src/types.ts`

## How to Verify

```bash
pnpm -F @flowforge/auth test jwt
```
