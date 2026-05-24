# [Epic-01] Setup Vitest test runner

**Labels**: `epic-01`, `good-first-issue`, `area-tooling`
**Estimate**: 1 jam
**Depends on**: #2

## Context

Vitest adalah test runner cepat dengan API mirip Jest, jalan native untuk TypeScript/ESM.

## Acceptance Criteria

- [ ] `vitest.config.ts` di root
- [ ] Script `pnpm test` jalan walau belum ada test
- [ ] Coverage script `pnpm test:coverage` ada
- [ ] Sample test `packages/shared/src/sample.test.ts` jalan dan pass

## Implementation Hints

Install:

```bash
pnpm add -Dw vitest @vitest/coverage-v8
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/dist/**'],
    },
  },
});
```

Sample test `packages/shared/src/sample.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sample', () => {
  it('passes', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Scripts di root:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Files Involved

- `vitest.config.ts`
- `packages/shared/src/sample.test.ts`

## How to Verify

```bash
pnpm test
# 1 test passed
pnpm test:coverage
# Coverage report tampil
```
