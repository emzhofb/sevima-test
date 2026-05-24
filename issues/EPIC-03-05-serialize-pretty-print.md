# [Epic-03] Serialize and pretty-print canonical JSON

**Labels**: `epic-03`, `area-parser`
**Estimate**: 1.5 jam
**Depends on**: #26

## Context

Output canonical: sorted keys lexicographic, indent 2 spaces, UTF-8, LF line ending. Round-trip property: `parse(serialize(d))` ekivalen dengan `d`.

## Acceptance Criteria

- [ ] Function `serialize(definition: WorkflowDefinition, format: 'json' | 'yaml'): string`
- [ ] Function `prettyPrint(definition: WorkflowDefinition): string` (canonical JSON)
- [ ] Sorted keys, 2-space indent, LF line ending
- [ ] Round-trip test pass: `parse(serialize(d))` === `d` field-by-field

## Implementation Hints

```ts
// packages/parser/src/serialize.ts
import { stringify as stringifyYaml } from 'yaml';
import type { WorkflowDefinition } from '@flowforge/shared';

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

export function prettyPrint(definition: WorkflowDefinition): string {
  const canonical = sortObjectKeys(definition);
  return JSON.stringify(canonical, null, 2) + '\n';
}

export function serialize(
  definition: WorkflowDefinition,
  format: 'json' | 'yaml' = 'json',
): string {
  if (format === 'yaml') {
    return stringifyYaml(sortObjectKeys(definition), { indent: 2, lineWidth: 0 });
  }
  return prettyPrint(definition);
}
```

Test cases:

```ts
import { describe, it, expect } from 'vitest';
import { serialize, prettyPrint } from './serialize.js';
import { parse } from './parser.js';
import type { WorkflowDefinition } from '@flowforge/shared';

const sampleDef: WorkflowDefinition = {
  name: 'test',
  timeout_sec: 60,
  steps: [
    { id: 'a', type: 'DELAY', depends_on: [], config: { ms: 100 }, continue_on_failure: false },
    { id: 'b', type: 'HTTP', depends_on: ['a'], config: { url: 'https://example.com', method: 'GET' }, continue_on_failure: false },
  ],
};

describe('serialize', () => {
  it('round-trip JSON: parse(serialize(d)) === d', () => {
    const json = serialize(sampleDef, 'json');
    const result = parse(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.definition).toEqual(sampleDef);
  });

  it('round-trip YAML', () => {
    const yaml = serialize(sampleDef, 'yaml');
    const result = parse(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.definition).toEqual(sampleDef);
  });

  it('prettyPrint is byte-idempotent', () => {
    const first = prettyPrint(sampleDef);
    const second = prettyPrint((parse(first) as any).definition);
    const third = prettyPrint((parse(second) as any).definition);
    expect(second).toBe(third);
  });

  it('sorts keys lexicographically', () => {
    const out = prettyPrint({ steps: [], timeout_sec: 60, name: 'x' } as any);
    // 'name' should come before 'steps' before 'timeout_sec'
    expect(out.indexOf('name')).toBeLessThan(out.indexOf('steps'));
    expect(out.indexOf('steps')).toBeLessThan(out.indexOf('timeout_sec'));
  });
});
```

## Files Involved

- `packages/parser/src/serialize.ts`
- `packages/parser/src/serialize.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser test serialize
```
