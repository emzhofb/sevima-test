# [Epic-03] Comprehensive error taxonomy tests

**Labels**: `epic-03`, `area-parser`, `area-testing`
**Estimate**: 1.5 jam
**Depends on**: #28, #29

## Context

Pastikan setiap kategori error muncul untuk input yang sesuai. Ini melindungi dari regresi.

## Acceptance Criteria

- [ ] Test minimal 1 case untuk masing-masing issue: `cycle`, `dangling_dependency`, `duplicate_id`, `unknown_field`, `type_mismatch`, `missing_required`, `out_of_range`, `unknown_step_type`, `input_too_large`
- [ ] Snapshot test optional untuk error message format

## Implementation Hints

```ts
// packages/parser/src/error-taxonomy.test.ts
import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

describe('error taxonomy', () => {
  const cases: Array<{ name: string; input: object; expectedIssue: string }> = [
    {
      name: 'cycle',
      input: { name: 't', timeout_sec: 60, steps: [
        { id: 'a', type: 'DELAY', depends_on: ['b'], config: {} },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: {} },
      ]},
      expectedIssue: 'cycle',
    },
    {
      name: 'dangling_dependency',
      input: { name: 't', timeout_sec: 60, steps: [
        { id: 'a', type: 'DELAY', depends_on: ['nonexistent'], config: {} },
      ]},
      expectedIssue: 'dangling_dependency',
    },
    {
      name: 'duplicate_id',
      input: { name: 't', timeout_sec: 60, steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: {} },
        { id: 'a', type: 'DELAY', depends_on: [], config: {} },
      ]},
      expectedIssue: 'duplicate_id',
    },
    {
      name: 'out_of_range max_attempts',
      input: { name: 't', timeout_sec: 60, steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: {},
          retry: { max_attempts: 11, backoff_base_ms: 1, backoff_max_ms: 100 } },
      ]},
      expectedIssue: 'out_of_range',
    },
    {
      name: 'out_of_range timeout_sec',
      input: { name: 't', timeout_sec: 100000, steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: {} },
      ]},
      expectedIssue: 'out_of_range',
    },
    {
      name: 'unknown_step_type',
      input: { name: 't', timeout_sec: 60, steps: [
        { id: 'a', type: 'UNKNOWN', depends_on: [], config: {} },
      ]},
      expectedIssue: 'unknown_step_type',
    },
    {
      name: 'missing_required name',
      input: { timeout_sec: 60, steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: {} }] },
      expectedIssue: 'missing_required',
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const result = parse(JSON.stringify(tc.input));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const issues = result.errors.map((e) => e.issue);
        expect(issues).toContain(tc.expectedIssue);
      }
    });
  }
});
```

## Files Involved

- `packages/parser/src/error-taxonomy.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser test error-taxonomy
```
