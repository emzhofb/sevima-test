import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateAndSortDAG, topologicalSort } from './validate.js';
import type { WorkflowDefinition } from '@flowforge/shared';

const baseStep = (id: string, deps: string[] = []) => ({
  id,
  type: 'DELAY' as const,
  depends_on: deps,
  config: { duration_ms: 100 },
  continue_on_failure: false,
});

describe('validateAndSortDAG Unit Tests', () => {
  it('accepts valid linear DAG', () => {
    const def: WorkflowDefinition = {
      name: 'test',
      timeout_sec: 60,
      steps: [baseStep('a'), baseStep('b', ['a']), baseStep('c', ['b'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sorted).toEqual(['a', 'b', 'c']);
  });

  it('detects cycle', () => {
    const def: WorkflowDefinition = {
      name: 'test',
      timeout_sec: 60,
      steps: [baseStep('a', ['b']), baseStep('b', ['a'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.issue).toBe('cycle');
  });

  it('detects dangling dependency', () => {
    const def: WorkflowDefinition = {
      name: 'test',
      timeout_sec: 60,
      steps: [baseStep('a', ['nonexistent'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.issue).toBe('dangling_dependency');
  });

  it('detects duplicate IDs', () => {
    const def: WorkflowDefinition = {
      name: 'test',
      timeout_sec: 60,
      steps: [baseStep('a'), baseStep('a')],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.issue).toBe('duplicate_id');
  });

  it('handles diamond DAG', () => {
    const def: WorkflowDefinition = {
      name: 'test',
      timeout_sec: 60,
      steps: [baseStep('a'), baseStep('b', ['a']), baseStep('c', ['a']), baseStep('d', ['b', 'c'])],
    };
    const result = validateAndSortDAG(def);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sorted[0]).toBe('a');
      expect(result.sorted[3]).toBe('d');
    }
  });

  it('topologicalSort returns sorted order on success, throws on cycle', () => {
    const def: WorkflowDefinition = {
      name: 'test',
      timeout_sec: 60,
      steps: [baseStep('a'), baseStep('b', ['a'])],
    };
    expect(topologicalSort(def)).toEqual(['a', 'b']);

    const cycleDef: WorkflowDefinition = {
      name: 'cycle',
      timeout_sec: 60,
      steps: [baseStep('a', ['b']), baseStep('b', ['a'])],
    };
    expect(() => topologicalSort(cycleDef)).toThrow();
  });
});

describe('Property 2: DAG Validity Property-Based Tests', () => {
  const stepIdArb = fc.stringMatching(/^[a-z0-9]{1,10}$/);

  const validWorkflowArb = fc.integer({ min: 1, max: 20 }).chain((numSteps) => {
    return fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 50 }), // name
        fc.integer({ min: 1, max: 86400 }), // timeout_sec
        fc.uniqueArray(stepIdArb, { minLength: numSteps, maxLength: numSteps }), // step IDs
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

  it('validates that any topologically constructable DAG is accepted', () => {
    fc.assert(
      fc.property(validWorkflowArb, (wf) => {
        const res = validateAndSortDAG(wf as any);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.sorted.length).toBe(wf.steps.length);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('validates that cycle addition causes validation failure', () => {
    fc.assert(
      fc.property(validWorkflowArb, (wf) => {
        // Only inject cycle if we have at least 1 step
        if (wf.steps.length > 0) {
          // Self-loop on first step
          const wfWithCycle = JSON.parse(JSON.stringify(wf));
          wfWithCycle.steps[0].depends_on.push(wfWithCycle.steps[0].id);
          const res = validateAndSortDAG(wfWithCycle);
          expect(res.ok).toBe(false);
          if (!res.ok) {
            expect(
              res.errors.some((e) => e.issue === 'cycle' || e.issue === 'dangling_dependency'),
            ).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
