# [Epic-05] Setup auth package skeleton

**Labels**: `epic-05`, `good-first-issue`, `area-auth`
**Estimate**: 0.5 jam
**Depends on**: #16

## Context

Auth utilities di-isolate ke `packages/auth` agar bisa dipakai API dan WebSocket.

## Acceptance Criteria

- [ ] `packages/auth/package.json` ada
- [ ] Dependencies: `jsonwebtoken`, `argon2`, `@flowforge/shared`
- [ ] Skeleton index.ts ekspor placeholders

## Implementation Hints

```bash
pnpm add -F @flowforge/auth jsonwebtoken argon2 @flowforge/shared
pnpm add -F @flowforge/auth -D @types/jsonwebtoken
```

```ts
// packages/auth/src/index.ts
export { hashPassword, verifyPassword } from './password.js';
export { signJwt, verifyJwt } from './jwt.js';
export { authenticate } from './middleware.js';
export type { JwtClaims, RequestContext } from './types.js';
```

## Files Involved

- `packages/auth/package.json`
- `packages/auth/src/index.ts` + placeholder files

## How to Verify

```bash
pnpm -F @flowforge/auth typecheck
```
