import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

describe('Error Taxonomy', () => {
  const cases: Array<{ name: string; input: object; expectedIssue: string }> = [
    {
      name: 'cycle',
      input: {
        name: 't',
        timeout_sec: 60,
        steps: [
          { id: 'a', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 100 } },
          { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 } },
        ],
      },
      expectedIssue: 'cycle',
    },
    {
      name: 'dangling_dependency',
      input: {
        name: 't',
        timeout_sec: 60,
        steps: [
          { id: 'a', type: 'DELAY', depends_on: ['nonexistent'], config: { duration_ms: 100 } },
        ],
      },
      expectedIssue: 'dangling_dependency',
    },
    {
      name: 'duplicate_id',
      input: {
        name: 't',
        timeout_sec: 60,
        steps: [
          { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } },
          { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } },
        ],
      },
      expectedIssue: 'duplicate_id',
    },
    {
      name: 'out_of_range max_attempts',
      input: {
        name: 't',
        timeout_sec: 60,
        steps: [
          {
            id: 'a',
            type: 'DELAY',
            depends_on: [],
            config: { duration_ms: 100 },
            retry: { max_attempts: 11, backoff_base_ms: 1, backoff_max_ms: 100 },
          },
        ],
      },
      expectedIssue: 'out_of_range',
    },
    {
      name: 'out_of_range timeout_sec',
      input: {
        name: 't',
        timeout_sec: 100000,
        steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
      },
      expectedIssue: 'out_of_range',
    },
    {
      name: 'unknown_step_type',
      input: {
        name: 't',
        timeout_sec: 60,
        steps: [{ id: 'a', type: 'UNKNOWN', depends_on: [], config: {} }],
      },
      expectedIssue: 'unknown_step_type',
    },
    {
      name: 'missing_required name',
      input: {
        timeout_sec: 60,
        steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
      },
      expectedIssue: 'missing_required',
    },
    {
      name: 'unknown_field at root',
      input: {
        name: 't',
        timeout_sec: 60,
        extra_root_field: 'should-fail',
        steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
      },
      expectedIssue: 'unknown_field',
    },
    {
      name: 'type_mismatch on timeout_sec',
      input: {
        name: 't',
        timeout_sec: 'not-a-number',
        steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
      },
      expectedIssue: 'type_mismatch',
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
