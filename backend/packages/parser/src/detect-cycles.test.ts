import { describe, it, expect } from 'vitest';
import { detectCycles } from './detect-cycles.js';

const baseStep = (id: string, deps: string[] = []) => ({
  id,
  type: 'DELAY' as const,
  depends_on: deps,
  config: {},
  continue_on_failure: false,
});

describe('detectCycles', () => {
  it('returns empty array when there are no cycles', () => {
    const def = {
      name: 'no-cycle',
      timeout_sec: 60,
      steps: [
        baseStep('a'),
        baseStep('b', ['a']),
        baseStep('c', ['b']),
      ],
    };
    const cycles = detectCycles(def);
    expect(cycles.length).toBe(0);
  });

  it('detects self-loop cycle', () => {
    const def = {
      name: 'self-loop',
      timeout_sec: 60,
      steps: [
        baseStep('a', ['a']),
      ],
    };
    const cycles = detectCycles(def);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toEqual(['a', 'a']);
  });

  it('detects simple cycle of size 2', () => {
    const def = {
      name: 'cycle-2',
      timeout_sec: 60,
      steps: [
        baseStep('a', ['b']),
        baseStep('b', ['a']),
      ],
    };
    const cycles = detectCycles(def);
    expect(cycles.length).toBeGreaterThan(0);
    // Cycle path should trace the nodes in cycle
    expect(cycles[0]).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('detects nested cycles', () => {
    const def = {
      name: 'nested-cycles',
      timeout_sec: 60,
      steps: [
        baseStep('a', ['c']),
        baseStep('b', ['a']),
        baseStep('c', ['b']),
      ],
    };
    const cycles = detectCycles(def);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
