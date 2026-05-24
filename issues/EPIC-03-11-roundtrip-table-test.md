# [Epic-03] Round-trip table test (instead of property-based)

**Labels**: `epic-03`, `area-parser`, `area-testing`
**Estimate**: 1 jam
**Depends on**: #28, #29

## Context

> Original spec menggunakan property-based testing dengan fast-check. Untuk fresh grad, kita pakai table test dengan cases yang sudah di-curate. Tetap menguji round-trip property dengan input variasi.

## Acceptance Criteria

- [ ] File test `roundtrip.test.ts` punya minimal 10 case beragam
- [ ] Case mencakup: linear, fan-out, fan-in, diamond, single step, banyak step
- [ ] `parse(serialize(d)) === d` untuk semua case (deep equal)

## Implementation Hints

```ts
// packages/parser/src/roundtrip.test.ts
import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';
import { serialize } from './serialize.js';
import type { WorkflowDefinition } from '@flowforge/shared';

const cases: Array<{ name: string; def: WorkflowDefinition }> = [
  {
    name: 'single step',
    def: {
      name: 'one', timeout_sec: 60,
      steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false }],
    },
  },
  {
    name: 'linear chain',
    def: {
      name: 'linear', timeout_sec: 60,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'c', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 100 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'diamond',
    def: {
      name: 'diamond', timeout_sec: 60,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'c', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'd', type: 'DELAY', depends_on: ['b', 'c'], config: { duration_ms: 100 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'with retry policy',
    def: {
      name: 'retry', timeout_sec: 60,
      steps: [{
        id: 'a', type: 'HTTP', depends_on: [],
        config: { method: 'GET', url: 'https://example.com' },
        retry: { max_attempts: 3, backoff_base_ms: 100, backoff_max_ms: 1000, jitter: true },
        continue_on_failure: false,
      }],
    },
  },
  // tambahkan minimal 6 case lagi: fan-out, fan-in 3 deps, mixed step types, dst.
];

describe('round-trip JSON', () => {
  for (const tc of cases) {
    it(tc.name, () => {
      const json = serialize(tc.def, 'json');
      const result = parse(json);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.definition).toEqual(tc.def);
    });
  }
});

describe('round-trip YAML', () => {
  for (const tc of cases) {
    it(tc.name, () => {
      const yaml = serialize(tc.def, 'yaml');
      const result = parse(yaml);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.definition).toEqual(tc.def);
    });
  }
});
```

## Files Involved

- `packages/parser/src/roundtrip.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser test roundtrip
```
