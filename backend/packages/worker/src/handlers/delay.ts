import type { StepOutcome } from '../index.js';

export async function executeDelay(spec: any): Promise<StepOutcome> {
  const ms = spec.config?.duration_ms;
  if (typeof ms !== 'number' || ms <= 0 || ms > 3_600_000) {
    return { ok: false, error: 'Invalid duration_ms: must be a number between 1 and 3600000' };
  }
  await new Promise((r) => setTimeout(r, ms));
  return { ok: true, output: { delayed_ms: ms } };
}
