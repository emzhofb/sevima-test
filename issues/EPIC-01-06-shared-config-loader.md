# [Epic-01] Shared environment config loader

**Labels**: `epic-01`, `good-first-issue`, `area-shared`
**Estimate**: 1 jam
**Depends on**: #2

## Context

Pusat-kan loading + validasi env variable di `packages/shared` agar tidak diulang di setiap service.

## Acceptance Criteria

- [ ] File `packages/shared/src/config.ts` mengekspor `loadConfig()`
- [ ] Validasi pakai zod, throw error informatif kalau env hilang
- [ ] Test unit untuk validasi config

## Implementation Hints

Install di shared:

```bash
pnpm add -F @flowforge/shared zod dotenv
```

`packages/shared/src/config.ts`:

```ts
import { z } from 'zod';
import 'dotenv/config';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET harus minimal 32 karakter'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  return result.data;
}
```

`packages/shared/src/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('throws when JWT_SECRET is short', () => {
    process.env.JWT_SECRET = 'short';
    process.env.DATABASE_URL = 'postgres://x:y@localhost/z';
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(() => loadConfig()).toThrow();
  });
});
```

## Files Involved

- `packages/shared/src/config.ts`
- `packages/shared/src/config.test.ts`
- `packages/shared/src/index.ts` (export config)

## How to Verify

```bash
pnpm -F @flowforge/shared test
```
