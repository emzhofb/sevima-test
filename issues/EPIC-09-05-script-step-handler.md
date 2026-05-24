# [Epic-09] SCRIPT step handler (basic sandbox via child_process)

**Labels**: `epic-09`, `area-worker`
**Estimate**: 2 jam
**Depends on**: #71

## Context

> Original spec: Docker container per step + Firecracker MicroVM. Untuk fresh grad: child_process spawn dengan timeout. Tidak isolated network/fs (best-effort). Production deployment WAJIB ganti dengan sandbox proper. Documented sebagai `WARNING` di code.

## Acceptance Criteria

- [ ] Function `executeScript(spec, runId, db)`
- [ ] Spawn `node -e <code>` atau `python -c <code>` dengan timeout
- [ ] Capture stdout / stderr
- [ ] Output: `{ stdout, exit_code }`
- [ ] Failure jika exit_code !== 0 atau timeout
- [ ] Big WARNING comment

## Implementation Hints

```ts
// packages/worker/src/handlers/script.ts
import { spawn } from 'child_process';

/**
 * WARNING: This is a basic sandbox for MVP only.
 * For production: replace with Docker/Firecracker isolation.
 * Current limitations:
 * - Script has same network access as worker
 * - Script can read/write filesystem (dangerous!)
 * - Script can consume unlimited memory (kernel OOM only)
 *
 * Track as production-blocker before public deploy.
 */
export async function executeScript(spec: any, runId: string, db: any): Promise<StepOutcome> {
  const { language, code } = spec.config;
  const timeoutSec = spec.timeout_sec ?? 60;

  const command = language === 'python' ? 'python3' : 'node';
  const args = language === 'python' ? ['-c', code] : ['-e', code];

  return new Promise<StepOutcome>((resolve) => {
    const child = spawn(command, args, {
      timeout: timeoutSec * 1000,
      env: {
        // Pass minimum env. Do NOT inherit process.env.
        PATH: '/usr/bin:/usr/local/bin',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); if (stdout.length > 1024 * 1024) child.kill(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        return resolve({ ok: false, error: `Timeout or killed (${signal})` });
      }
      if (code !== 0) {
        return resolve({ ok: false, error: `Exit ${code}: ${stderr.slice(0, 500)}` });
      }
      resolve({ ok: true, output: { stdout: stdout.slice(0, 100000), exit_code: code } });
    });

    child.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}
```

Test:

```ts
it('runs simple node script', async () => {
  const result = await executeScript(
    { config: { language: 'javascript', code: 'console.log("hello")' }, timeout_sec: 5 },
    'run1', null,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect((result.output as any).stdout).toContain('hello');
});

it('fails on non-zero exit', async () => {
  const result = await executeScript(
    { config: { language: 'javascript', code: 'process.exit(1)' }, timeout_sec: 5 },
    'run1', null,
  );
  expect(result.ok).toBe(false);
});

it('times out long-running script', async () => {
  const result = await executeScript(
    { config: { language: 'javascript', code: 'while(true){}' }, timeout_sec: 1 },
    'run1', null,
  );
  expect(result.ok).toBe(false);
});
```

## Files Involved

- `packages/worker/src/handlers/script.ts`
- `packages/worker/src/handlers/script.test.ts`
- `docs/SECURITY.md` — list this as known limitation

## How to Verify

```bash
pnpm -F @flowforge/worker test script
```
