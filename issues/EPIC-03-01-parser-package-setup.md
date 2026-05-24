# [Epic-03] Setup parser package skeleton

**Labels**: `epic-03`, `good-first-issue`, `area-parser`
**Estimate**: 0.5 jam
**Depends on**: #16 (shared types)

## Context

Buat skeleton untuk `packages/parser`.

## Acceptance Criteria

- [ ] `packages/parser/src/index.ts` ekspor placeholder `parse`, `validateAndSortDAG`, `serialize`
- [ ] `packages/parser/package.json` depend on `@flowforge/shared`
- [ ] Build sukses

## Implementation Hints

```ts
// packages/parser/src/index.ts
export type { ValidationResult } from './types.js';
export { parse, parseFromYaml, parseFromJson } from './parser.js';
export { validateAndSortDAG } from './validate.js';
export { serialize, prettyPrint } from './serialize.js';
```

`packages/parser/package.json`:

```json
{
  "name": "@flowforge/parser",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@flowforge/shared": "workspace:*",
    "yaml": "^2.4.0"
  }
}
```

## Files Involved

- `packages/parser/package.json`
- `packages/parser/src/index.ts`
- `packages/parser/src/types.ts` (placeholder)
- `packages/parser/src/parser.ts` (placeholder)
- `packages/parser/src/validate.ts` (placeholder)
- `packages/parser/src/serialize.ts` (placeholder)

## How to Verify

```bash
pnpm -F @flowforge/parser typecheck
```
