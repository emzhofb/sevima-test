import { describe, it, expect } from 'vitest';
import { executeDelay } from './delay.js';

describe('executeDelay', () => {
  it('delays for the specified duration and returns ok', async () => {
    const start = Date.now();
    const result = await executeDelay({ config: { duration_ms: 100 } });
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(90); // allow slight timing variance
    if (result.ok) {
      expect((result.output as any).delayed_ms).toBe(100);
    }
  });

  it('rejects negative duration', async () => {
    const result = await executeDelay({ config: { duration_ms: -1 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid duration_ms');
    }
  });

  it('rejects zero duration', async () => {
    const result = await executeDelay({ config: { duration_ms: 0 } });
    expect(result.ok).toBe(false);
  });

  it('rejects duration exceeding 1 hour (3600000ms)', async () => {
    const result = await executeDelay({ config: { duration_ms: 3_600_001 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid duration_ms');
    }
  });

  it('accepts exactly 1ms', async () => {
    const result = await executeDelay({ config: { duration_ms: 1 } });
    expect(result.ok).toBe(true);
  });

  it('rejects duration just over 1 hour (3600001ms)', async () => {
    const result = await executeDelay({ config: { duration_ms: 3_600_001 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid duration_ms');
    }
  });

  it('rejects non-numeric duration', async () => {
    const result = await executeDelay({ config: { duration_ms: 'fast' } });
    expect(result.ok).toBe(false);
  });

  it('rejects missing config', async () => {
    const result = await executeDelay({});
    expect(result.ok).toBe(false);
  });
});
