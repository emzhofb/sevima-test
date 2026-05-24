import type { StepOutcome } from '../index.js';

/**
 * CONDITIONAL step handler stub.
 * Evaluates a condition expression and branches accordingly.
 * Full implementation in a future issue.
 */
export async function executeConditional(_spec: any, _runId: string, _db: any): Promise<StepOutcome> {
  // Stub: always succeeds, indicating the condition branch was evaluated
  return { ok: true, output: { evaluated: true } };
}
