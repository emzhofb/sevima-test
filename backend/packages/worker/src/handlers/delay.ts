import type { StepOutcome } from '../index.js';

export async function executeDelay(spec: any, runId?: string, redis?: any): Promise<StepOutcome> {
  const ms = spec.config?.duration_ms;
  if (typeof ms !== 'number' || ms <= 0 || ms > 3_600_000) {
    return { ok: false, error: 'Invalid duration_ms: must be a number between 1 and 3600000' };
  }

  const end = Date.now() + ms;
  while (Date.now() < end) {
    const cancelled = redis && runId ? await redis.exists(`flowforge:cancel:run:${runId}`).catch(() => 0) : 0;
    if (cancelled === 1) {
      return { ok: false, error: 'Step execution cancelled' };
    }
    const remain = end - Date.now();
    await new Promise((r) => setTimeout(r, Math.min(remain, 1000)));
  }

  return { ok: true, output: { delayed_ms: ms } };
}
