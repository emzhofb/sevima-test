import { describe, it, expect } from 'vitest';
import { executeScript } from './script.js';

describe('executeScript', () => {
  it('runs a simple node script and captures stdout', async () => {
    const result = await executeScript(
      { config: { language: 'javascript', code: 'console.log("hello world")' }, timeout_sec: 5 },
      'run-1',
      null,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).stdout).toContain('hello world');
      expect((result.output as any).exit_code).toBe(0);
    }
  }, 10000);

  it('fails on non-zero exit code', async () => {
    const result = await executeScript(
      { config: { language: 'javascript', code: 'process.exit(1)' }, timeout_sec: 5 },
      'run-1',
      null,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Exit 1');
  }, 10000);

  it('fails with error message when script throws', async () => {
    const result = await executeScript(
      { config: { language: 'javascript', code: 'throw new Error("oops")' }, timeout_sec: 5 },
      'run-1',
      null,
    );
    expect(result.ok).toBe(false);
  }, 10000);

  it('times out a long-running script', async () => {
    const result = await executeScript(
      {
        config: {
          language: 'javascript',
          code: 'const x = Date.now(); while(Date.now() - x < 5000){}',
        },
        timeout_sec: 1,
      },
      'run-1',
      null,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Timeout|killed|SIGTERM|SIGKILL/i);
  }, 10000);

  it('returns error for missing code', async () => {
    const result = await executeScript({ config: {} }, 'run-1', null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Missing or invalid code');
  }, 5000);

  it('outputs JSON from script', async () => {
    const result = await executeScript(
      {
        config: { language: 'javascript', code: 'console.log(JSON.stringify({value: 42}))' },
        timeout_sec: 5,
      },
      'run-1',
      null,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.output as any).stdout).toContain('42');
    }
  }, 10000);
});
