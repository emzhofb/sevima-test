# [Epic-01] Setup TypeScript base configuration

**Labels**: `epic-01`, `good-first-issue`, `area-tooling`
**Estimate**: 1 jam
**Depends on**: #1 (init monorepo)

## Context

Setiap package butuh TypeScript dengan setting strict yang sama. Kita pakai pendekatan `tsconfig.base.json` di root yang di-extend oleh setiap package.

## Acceptance Criteria

- [ ] `tsconfig.base.json` di root dengan strict mode aktif
- [ ] Setiap `packages/*/tsconfig.json` extends dari root
- [ ] `pnpm typecheck` sukses di semua packages
- [ ] TypeScript versi >=5.3 di root devDependencies

## Implementation Hints

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist"]
}
```

`packages/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

Tambahkan script di root `package.json`:

```json
{
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm -r build"
  }
}
```

Per package:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  }
}
```

## Files Involved

- `tsconfig.base.json`
- `packages/*/tsconfig.json` (×9)
- Update `package.json` di root + each package

## How to Verify

```bash
pnpm typecheck
# Tidak ada error
```
