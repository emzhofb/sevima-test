import type { StepOutcome } from '../index.js';

/**
 * SCRIPT step handler stub.
 * Executes an inline script in a sandboxed environment.
 * Full implementation in a future issue.
 */
export async function executeScript(_spec: any, _runId: string, _db: any): Promise<StepOutcome> {
  // Stub: always succeeds
  return { ok: true, output: { executed: true } };
}
