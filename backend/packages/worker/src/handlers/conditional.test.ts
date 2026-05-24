import { describe, it, expect, vi } from 'vitest';
import { executeConditional } from './conditional.js';

// Mock expr-eval module
vi.mock('expr-eval', () => ({
  Parser: class MockParser {
    parse(expr: string) {
      return {
        evaluate: (ctx: any) => {
          // Simple safe eval for test - only handles basic expressions
          // Replace dot notation for nested access
          const fn = new Function(...Object.keys(ctx), `return (${expr})`);
          try {
            return fn(...Object.values(ctx));
          } catch {
            throw new Error(`Cannot evaluate: ${expr}`);
          }
        },
      };
    }
  },
}));

function makeDb(stepOutputs: { step_id: string; output: any }[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows: stepOutputs }),
  };
}

describe('executeConditional', () => {
  it('evaluates simple true comparison', async () => {
    const db = makeDb([{ step_id: 'fetch', output: { count: 10 } }]);
    const result = await executeConditional(
      { config: { expr: 'input.fetch.count > 5' } },
      'run-1',
      db,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.output as any).result).toBe(true);
  });

  it('evaluates simple false comparison', async () => {
    const db = makeDb([{ step_id: 'fetch', output: { count: 3 } }]);
    const result = await executeConditional(
      { config: { expr: 'input.fetch.count > 5' } },
      'run-1',
      db,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.output as any).result).toBe(false);
  });

  it('returns error for missing expr', async () => {
    const result = await executeConditional({ config: {} }, 'run-1', makeDb());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Missing or invalid expr');
  });

  it('returns error for empty expr string', async () => {
    const result = await executeConditional({ config: { expr: '' } }, 'run-1', makeDb());
    expect(result.ok).toBe(false);
  });

  it('returns error when expression evaluation fails', async () => {
    const db = makeDb([]);
    const result = await executeConditional(
      { config: { expr: 'nonexistent.deeply.nested' } },
      'run-1',
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Expression error');
  });

  it('works without db (db is null)', async () => {
    const result = await executeConditional({ config: { expr: '1 + 1 === 2' } }, 'run-1', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.output as any).result).toBe(true);
  });
});
