# [Epic-09] CONDITIONAL step handler

**Labels**: `epic-09`, `area-worker`
**Estimate**: 1.5 jam
**Depends on**: #71

## Context

Evaluasi expression sederhana untuk decide branch. Untuk fresh grad, batasi expression syntax.

> Versi sederhana: support comparison `a === b`, `a > b`, `a < b`, dan `&&`/`||`. Tidak support function call atau loop. Pakai `expr-eval` library.

## Acceptance Criteria

- [ ] Function `executeConditional(spec, runId, db)`
- [ ] Resolve input dari step sebelumnya (akan dijelaskan di bawah)
- [ ] Output: `{ result: boolean }` — true atau false
- [ ] Test untuk berbagai expression

## Implementation Hints

```bash
pnpm add -F @flowforge/worker expr-eval
```

```ts
// packages/worker/src/handlers/conditional.ts
import { Parser } from 'expr-eval';

export async function executeConditional(spec: any, runId: string, db: any): Promise<StepOutcome> {
  const expr = spec.config.expr;
  if (typeof expr !== 'string' || expr.length === 0) {
    return { ok: false, error: 'Missing or invalid expr' };
  }

  // Build context from previous step outputs
  const stepRunsRes = await db.query(
    `SELECT step_id, output FROM step_runs WHERE run_id = $1 AND status = 'SUCCEEDED'`,
    [runId],
  );
  const context: Record<string, unknown> = { input: {} };
  for (const row of stepRunsRes.rows) {
    (context.input as any)[row.step_id] = row.output;
  }

  try {
    const parser = new Parser();
    const result = parser.parse(expr).evaluate(context);
    return { ok: true, output: { result: Boolean(result) } };
  } catch (err) {
    return { ok: false, error: `Expression error: ${(err as Error).message}` };
  }
}
```

> **Note**: `expr-eval` jauh lebih aman daripada `eval()`. Jangan pakai `eval()` atau `new Function()` di tempat ini.

Test:

```ts
it('evaluates simple comparison', async () => {
  const mockDb = {
    query: async () => ({ rows: [{ step_id: 'fetch', output: { count: 10 } }] }),
  };
  const result = await executeConditional(
    { config: { expr: 'input.fetch.count > 5' } },
    'run1', mockDb,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect((result.output as any).result).toBe(true);
});
```

## Files Involved

- `packages/worker/src/handlers/conditional.ts`
- `packages/worker/src/handlers/conditional.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/worker test conditional
```
