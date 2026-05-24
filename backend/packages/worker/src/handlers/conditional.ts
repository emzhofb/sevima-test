import type { StepOutcome } from '../index.js';

// Use a safe expression evaluator instead of eval() or new Function()
// expr-eval only supports math, comparisons, and logical operators — no arbitrary code execution.

let parserModule: any = null;
async function getParser() {
  if (!parserModule) {
    // Dynamic import to allow mocking in tests
    parserModule = await import('expr-eval');
  }
  return parserModule;
}

export async function executeConditional(spec: any, runId: string, db: any): Promise<StepOutcome> {
  const expr = spec.config?.expr;
  if (typeof expr !== 'string' || expr.length === 0) {
    return { ok: false, error: 'Missing or invalid expr in config' };
  }

  // Build context from previous step outputs
  const context: Record<string, unknown> = { input: {} };
  if (db) {
    const stepRunsRes = await db.query(
      `SELECT step_id, output FROM step_runs WHERE run_id = $1 AND status = 'SUCCEEDED'`,
      [runId],
    );
    for (const row of stepRunsRes.rows) {
      (context.input as Record<string, unknown>)[row.step_id] = row.output;
    }
  }

  try {
    const { Parser } = await getParser();
    const parser = new Parser();
    const result = parser.parse(expr).evaluate(context);
    return { ok: true, output: { result: Boolean(result) } };
  } catch (err) {
    return { ok: false, error: `Expression error: ${(err as Error).message}` };
  }
}
