# [Epic-03] computeReadySet helper

**Labels**: `epic-03`, `area-parser`
**Estimate**: 1 jam
**Depends on**: #27

## Context

Function `computeReadySet(definition, completedStepIds)` mengembalikan set step yang siap dieksekusi (semua dep sudah ada di `completedStepIds`). Dipakai oleh orchestrator.

## Acceptance Criteria

- [ ] Function `computeReadySet(definition: WorkflowDefinition, completed: Set<string>): Set<string>`
- [ ] Hanya mengembalikan step yang belum di `completed` dan semua `depends_on`-nya ada di `completed`
- [ ] Test untuk berbagai stage eksekusi

## Implementation Hints

```ts
// packages/parser/src/ready-set.ts
import type { WorkflowDefinition } from '@flowforge/shared';

export function computeReadySet(
  definition: WorkflowDefinition,
  completed: Set<string>,
): Set<string> {
  const ready = new Set<string>();
  for (const step of definition.steps) {
    if (completed.has(step.id)) continue;
    const allDepsCompleted = step.depends_on.every((dep) => completed.has(dep));
    if (allDepsCompleted) ready.add(step.id);
  }
  return ready;
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import { computeReadySet } from './ready-set.js';

const sampleDef = {
  name: 'test', timeout_sec: 60,
  steps: [
    { id: 'a', type: 'DELAY' as const, depends_on: [], config: {}, continue_on_failure: false },
    { id: 'b', type: 'DELAY' as const, depends_on: ['a'], config: {}, continue_on_failure: false },
    { id: 'c', type: 'DELAY' as const, depends_on: ['a'], config: {}, continue_on_failure: false },
    { id: 'd', type: 'DELAY' as const, depends_on: ['b', 'c'], config: {}, continue_on_failure: false },
  ],
};

describe('computeReadySet', () => {
  it('initial: only a is ready', () => {
    const ready = computeReadySet(sampleDef, new Set());
    expect([...ready]).toEqual(['a']);
  });

  it('after a: b and c are ready', () => {
    const ready = computeReadySet(sampleDef, new Set(['a']));
    expect([...ready].sort()).toEqual(['b', 'c']);
  });

  it('after a, b: only c (d still has c missing)', () => {
    const ready = computeReadySet(sampleDef, new Set(['a', 'b']));
    expect([...ready]).toEqual(['c']);
  });

  it('after a, b, c: d is ready', () => {
    const ready = computeReadySet(sampleDef, new Set(['a', 'b', 'c']));
    expect([...ready]).toEqual(['d']);
  });

  it('all completed: empty', () => {
    const ready = computeReadySet(sampleDef, new Set(['a', 'b', 'c', 'd']));
    expect(ready.size).toBe(0);
  });
});
```

## Files Involved

- `packages/parser/src/ready-set.ts`
- `packages/parser/src/ready-set.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser test ready-set
```
