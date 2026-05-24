import { describe, it, expect } from 'vitest';
import { computeReadySet } from './ready-set.js';

const sampleDef = {
  name: 'test',
  timeout_sec: 60,
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
