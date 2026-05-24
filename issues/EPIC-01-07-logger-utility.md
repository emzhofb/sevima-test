# [Epic-01] Shared logger utility

**Labels**: `epic-01`, `good-first-issue`, `area-shared`
**Estimate**: 1 jam
**Depends on**: #6 (config)

## Context

Logger terstruktur (JSON) yang dipakai di semua service. Kita pakai `pino` karena cepat dan default JSON.

## Acceptance Criteria

- [ ] `packages/shared/src/logger.ts` ekspor `createLogger(name: string)`
- [ ] Logger output JSON di production, pretty di development
- [ ] Setiap log entry punya `name` (service name)

## Implementation Hints

```bash
pnpm add -F @flowforge/shared pino
pnpm add -F @flowforge/shared -D pino-pretty
```

`packages/shared/src/logger.ts`:

```ts
import pino, { Logger } from 'pino';

export function createLogger(name: string): Logger {
  const isDev = process.env.NODE_ENV !== 'production';

  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        }
      : undefined,
  });
}
```

Penggunaan di service lain:

```ts
import { createLogger } from '@flowforge/shared';
const log = createLogger('api');
log.info({ userId: 'abc' }, 'user logged in');
```

## Files Involved

- `packages/shared/src/logger.ts`
- Update `packages/shared/src/index.ts`

## How to Verify

Jalankan script kecil yang panggil `createLogger('test').info('hello')`, output JSON terlihat di console.
