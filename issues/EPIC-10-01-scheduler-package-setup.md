# [Epic-10] Scheduler package skeleton

**Labels**: `epic-10`, `good-first-issue`, `area-scheduler`
**Estimate**: 0.5 jam
**Depends on**: #56

## Context

Scheduler service jalan terpisah. Tugas: poll `schedules` table, trigger run yang due.

## Acceptance Criteria

- [ ] `packages/scheduler/package.json`
- [ ] `packages/scheduler/src/index.ts` skeleton

## Implementation Hints

Sama seperti orchestrator skeleton: load config, init db + redis + broker, start scheduler loop.

```ts
// packages/scheduler/src/server.ts
import { startScheduler } from './tick.js';
// ... bootstrap dan call startScheduler(db, broker)
```

## Files Involved

- `packages/scheduler/package.json`
- `packages/scheduler/src/index.ts`
- `packages/scheduler/src/server.ts`

## How to Verify

```bash
pnpm -F @flowforge/scheduler typecheck
```
