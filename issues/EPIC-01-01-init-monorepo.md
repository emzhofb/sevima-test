# [Epic-01] Initialize monorepo structure with pnpm workspaces

**Labels**: `epic-01`, `good-first-issue`, `area-tooling`
**Estimate**: 2 jam
**Depends on**: None

## Context

Kita akan membangun FlowForge dengan struktur monorepo agar package backend (api, orchestrator, worker, dll.) bisa share types/utilities dengan mudah. Issue ini meletakkan fondasi awal-awal.

## Acceptance Criteria

- [ ] Root `package.json` dengan field `"workspaces"` atau `pnpm-workspace.yaml`
- [ ] Folder berikut sudah dibuat dengan `package.json` minimal di masing-masing:
  - `packages/api`
  - `packages/orchestrator`
  - `packages/worker`
  - `packages/scheduler`
  - `packages/realtime`
  - `packages/parser`
  - `packages/auth`
  - `packages/shared`
  - `packages/web`
- [ ] Root README.md dengan satu paragraf deskripsi proyek
- [ ] `.gitignore` minimal (node_modules, dist, .env, .DS_Store, coverage)
- [ ] `pnpm install` (atau `npm install`) jalan tanpa error

## Implementation Hints

Pakai pnpm karena lebih cepat untuk monorepo. Install:

```bash
npm install -g pnpm
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

`package.json` di setiap sub-package:

```json
{
  "name": "@flowforge/api",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts"
}
```

## Files Involved

- `package.json` (root)
- `pnpm-workspace.yaml`
- `packages/*/package.json` (×9)
- `README.md`
- `.gitignore`

## How to Verify

```bash
pnpm install
ls packages/
# Harus tampil: api, auth, orchestrator, parser, realtime, scheduler, shared, web, worker
```
