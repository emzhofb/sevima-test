# [Epic-15] dev:all script (run all services concurrently)

**Labels**: `epic-15`, `good-first-issue`, `area-infra`
**Estimate**: 0.5 jam
**Depends on**: #50, #71, #82, #87, #89

## Context

Developer perlu jalankan API + orchestrator + worker + realtime + frontend bareng. Pakai `concurrently`.

## Acceptance Criteria

- [ ] Script `pnpm dev:all` jalankan semua services
- [ ] Output color-coded per service
- [ ] Ctrl+C kill semua

## Implementation Hints

```bash
pnpm add -Dw concurrently
```

Root `package.json`:

```json
{
  "scripts": {
    "dev:all": "concurrently -n api,orch,worker,sched,rt,web -c blue,green,yellow,magenta,cyan,white \"pnpm -F @flowforge/api dev\" \"pnpm -F @flowforge/orchestrator dev\" \"pnpm -F @flowforge/worker dev\" \"pnpm -F @flowforge/scheduler dev\" \"pnpm -F @flowforge/realtime dev\" \"pnpm -F @flowforge/web dev\""
  }
}
```

Per-package `dev` script (jika belum ada):

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts"
  }
}
```

## Files Involved

- `package.json` root
- Per-package `dev` script

## How to Verify

```bash
pnpm dev:all
# Semua service start, ada label warna per service
```
