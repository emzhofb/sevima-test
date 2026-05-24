import { describe, it, expect } from 'vitest';
import { serialize, prettyPrint } from './serialize.js';
import { parse } from './parser.js';
import type { WorkflowDefinition } from '@flowforge/shared';

const sampleDef: WorkflowDefinition = {
  name: 'test',
  timeout_sec: 60,
  steps: [
    {
      id: 'a',
      type: 'DELAY',
      depends_on: [],
      config: { duration_ms: 100 },
      continue_on_failure: false,
    },
    {
      id: 'b',
      type: 'HTTP',
      depends_on: ['a'],
      config: { url: 'https://example.com', method: 'GET' },
      continue_on_failure: false,
    },
  ],
};

describe('serialize', () => {
  it('round-trip JSON: parse(serialize(d)) === d', () => {
    const json = serialize(sampleDef, 'json');
    const result = parse(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition).toEqual(sampleDef);
    }
  });

  it('round-trip YAML', () => {
    const yaml = serialize(sampleDef, 'yaml');
    const result = parse(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition).toEqual(sampleDef);
    }
  });

  it('prettyPrint is byte-idempotent', () => {
    const first = prettyPrint(sampleDef);
    const secondResult = parse(first);
    expect(secondResult.ok).toBe(true);
    if (secondResult.ok) {
      const second = prettyPrint(secondResult.definition);
      const thirdResult = parse(second);
      expect(thirdResult.ok).toBe(true);
      if (thirdResult.ok) {
        const third = prettyPrint(thirdResult.definition);
        expect(second).toBe(third);
      }
    }
  });

  it('sorts keys lexicographically', () => {
    const out = prettyPrint({ steps: [], timeout_sec: 60, name: 'x' } as any);
    // 'name' should come before 'steps' before 'timeout_sec'
    expect(out.indexOf('name')).toBeLessThan(out.indexOf('steps'));
    expect(out.indexOf('steps')).toBeLessThan(out.indexOf('timeout_sec'));
  });
});

import fc from 'fast-check';

describe('Property-Based Tests for Serialization', () => {
  const stepIdArb = fc.stringMatching(/^[a-z0-9]{1,10}$/);

  const validWorkflowArb = fc.integer({ min: 1, max: 20 }).chain((numSteps) => {
    return fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 86400 }),
        fc.uniqueArray(stepIdArb, { minLength: numSteps, maxLength: numSteps }),
      )
      .chain(([name, timeout_sec, ids]) => {
        const stepsArbs = ids.map((id, index) => {
          const possibleDeps = ids.slice(0, index);
          const depsArb = possibleDeps.length === 0 ? fc.constant([]) : fc.subarray(possibleDeps);

          const typeArb = fc.constantFrom('HTTP', 'SCRIPT', 'DELAY', 'CONDITIONAL');

          return fc.tuple(typeArb, depsArb).chain(([type, depends_on]) => {
            let configArb: fc.Arbitrary<any>;
            if (type === 'HTTP') {
              configArb = fc.record({
                method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
                url: fc.constant('https://example.com'),
              });
            } else if (type === 'SCRIPT') {
              configArb = fc.record({
                language: fc.constantFrom('javascript', 'python'),
                code: fc.constant('console.log("hello");'),
              });
            } else if (type === 'DELAY') {
              configArb = fc.record({
                duration_ms: fc.integer({ min: 1, max: 1000 }),
              });
            } else {
              configArb = fc.record({
                expr: fc.constant('true'),
              });
            }

            return fc.record({
              id: fc.constant(id),
              type: fc.constant(type),
              depends_on: fc.constant(depends_on),
              config: configArb,
              continue_on_failure: fc.boolean(),
            });
          });
        });

        return fc.tuple(...stepsArbs).map((steps) => ({
          name,
          timeout_sec,
          steps,
        }));
      });
  });

  it('Property 9.1: parse(serialize(d, fmt)) === d for JSON and YAML', () => {
    fc.assert(
      fc.property(validWorkflowArb, (wf) => {
        // Test JSON round-trip
        const json = serialize(wf as any, 'json');
        const jsonResult = parse(json);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
          expect(jsonResult.definition).toEqual(wf);
        }

        // Test YAML round-trip
        const yaml = serialize(wf as any, 'yaml');
        const yamlResult = parse(yaml);
        expect(yamlResult.ok).toBe(true);
        if (yamlResult.ok) {
          expect(yamlResult.definition).toEqual(wf);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Property 9.2: prettyPrint is byte-idempotent', () => {
    fc.assert(
      fc.property(validWorkflowArb, (wf) => {
        const first = prettyPrint(wf as any);
        const secondResult = parse(first);
        expect(secondResult.ok).toBe(true);
        if (secondResult.ok) {
          const second = prettyPrint(secondResult.definition);
          const thirdResult = parse(second);
          expect(thirdResult.ok).toBe(true);
          if (thirdResult.ok) {
            const third = prettyPrint(thirdResult.definition);
            expect(second).toBe(third);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
