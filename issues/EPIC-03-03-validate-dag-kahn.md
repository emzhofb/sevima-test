# [Epic-03] Implement validateAndSortDAG with Kahn's algorithm

**Labels**: `epic-03`, `area-parser`
**Estimate**: 3 jam
**Depends on**: #25

## Context

Validasi DAG: cek duplicate ID, dangling dependency, cycle. Output: sorted array kalau valid.

## Acceptance Criteria

- [ ] Function `validateAndSortDAG(definition: WorkflowDefinition): ValidationResult`
- [ ] Detect duplicate step ID → return error `duplicate_id`
- [ ] Detect dangling dependency → return error `dangling_dependency` dengan step_id yang punya dep dangling
- [ ] Detect cycle → return error `cycle`
- [ ] Sukses → return `{ ok: true, sorted: [...] }` topological order
- [ ] Pure function (tidak modify input)
- [ ] Test untuk semua kasus

## Implementation Hints

```ts
// packages/parser/src/validate.ts
import type { WorkflowDefinition } from '@flowforge/shared';
import type { ValidationResult, ValidationError } from './types.js';

export function validateAndSortDAG(definition: WorkflowDefinition): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Check duplicate IDs
  const stepIds = new Set<string>();
  const duplicates = new Set<string>();
  for (const step of definition.steps) {
    if (stepIds.has(step.id)) {
      duplicates.add(step.id);
    }
    stepIds.add(step.id);
  }
  if (duplicates.size > 0) {
    for (const dup of duplicates) {
      errors.push({
        step_id: dup,
        issue: 'duplicate_id',
        message: `Step ID '${dup}' is duplicated`,
      });
    }
    return { ok: false, errors };
  }

  // 2. Build adjacency + in-degree
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const step of definition.steps) {
    inDegree.set(step.id, 0);
    adjacency.set(step.id, []);
  }

  for (const step of definition.steps) {
    for (const dep of step.depends_on) {
      if (!stepIds.has(dep)) {
        errors.push({
          step_id: step.id,
          issue: 'dangling_dependency',
          message: `Step '${step.id}' depends on missing step '${dep}'`,
        });
        continue;
      }
      adjacency.get(dep)!.push(step.id);
      inDegree.set(step.id, inDegree.get(step.id)! + 1);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 3. Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const child of adjacency.get(node)!) {
      const newDeg = inDegree.get(child)! - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  if (sorted.length !== stepIds.size) {
    return {
      ok: false,
      errors: [{
        step_id: null,
        issue: 'cycle',
        message: 'Workflow contains a cycle',
      }],
    };
  }

  return { ok: true, sorted };
}
```

Test cases:

```ts
import { describe, it, expect } from 'vitest';
import { validateAndSortDAG } from './validate.js';
import type { WorkflowDefinition } from '@flowforge/shared';

const baseStep = (id: string, deps: string[] = []) => ({
  id,
  type: 'DELAY' as const,
  depends_on: deps,
  config: { duration_ms: 100 },
  continue_on_failure: false,
});

describe('validateAndSortDAG', () => {
  it('accepts valid linear DAG', () => {
    const def: WorkflowDefinition = {
      name: 'test', timeout_sec: 60,
      steps: [baseStep('a'), baseStep('b', ['a']), baseStep('c', ['b'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sorted).toEqual(['a', 'b', 'c']);
  });

  it('detects cycle', () => {
    const def: WorkflowDefinition = {
      name: 'test', timeout_sec: 60,
      steps: [baseStep('a', ['b']), baseStep('b', ['a'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].issue).toBe('cycle');
  });

  it('detects dangling dependency', () => {
    const def: WorkflowDefinition = {
      name: 'test', timeout_sec: 60,
      steps: [baseStep('a', ['nonexistent'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].issue).toBe('dangling_dependency');
  });

  it('detects duplicate IDs', () => {
    const def: WorkflowDefinition = {
      name: 'test', timeout_sec: 60,
      steps: [baseStep('a'), baseStep('a')],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].issue).toBe('duplicate_id');
  });

  it('handles diamond DAG', () => {
    const def: WorkflowDefinition = {
      name: 'test', timeout_sec: 60,
      steps: [
        baseStep('a'),
        baseStep('b', ['a']),
        baseStep('c', ['a']),
        baseStep('d', ['b', 'c']),
      ],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sorted[0]).toBe('a');
      expect(result.sorted[3]).toBe('d');
    }
  });
});
```

## Files Involved

- `packages/parser/src/validate.ts`
- `packages/parser/src/validate.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser test validate
```
