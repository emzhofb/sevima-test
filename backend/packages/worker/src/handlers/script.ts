import { spawn } from 'child_process';
import type { StepOutcome } from '../index.js';

/**
 * WARNING: This is a basic sandbox for MVP only.
 * For production: replace with Docker/Firecracker isolation.
 * Current limitations:
 * - Script has same network access as worker
 * - Script can read/write filesystem (dangerous!)
 * - Script can consume unlimited memory (kernel OOM only)
 * - No resource limits enforced
 *
 * ⚠️ Track as production-blocker before public deploy.
 * See docs/SECURITY.md for details.
 */
export async function executeScript(spec: any, runId?: string, _db?: any, redis?: any): Promise<StepOutcome> {
  const { language, code } = spec.config ?? {};
  const timeoutSec = spec.timeout_sec ?? 60;

  if (!code || typeof code !== 'string') {
    return { ok: false, error: 'Missing or invalid code in config' };
  }

  const command = language === 'python' ? 'python3' : 'node';
  const args = language === 'python' ? ['-c', code] : ['-e', code];

  return new Promise<StepOutcome>((resolve) => {
    const child = spawn(command, args, {
      timeout: timeoutSec * 1000,
      env: {
        PATH: process.env.PATH || '/usr/bin:/usr/local/bin',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const checkInterval = redis && runId ? setInterval(async () => {
      const cancelled = await redis.exists(`flowforge:cancel:run:${runId}`).catch(() => 0);
      if (cancelled === 1) {
        child.kill('SIGKILL');
      }
    }, 1000) : undefined;

    let stdout = '';
    let stderr = '';
    const MAX_OUTPUT = 100 * 1024;

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_OUTPUT) {
        child.kill();
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString().slice(0, 500);
    });

    child.on('exit', (code, signal) => {
      if (checkInterval) clearInterval(checkInterval);
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        return resolve({ ok: false, error: `Timeout or killed (${signal})` });
      }
      if (code !== 0) {
        return resolve({ ok: false, error: `Exit ${code}: ${stderr.slice(0, 500)}` });
      }
      resolve({
        ok: true,
        output: {
          stdout: stdout.slice(0, MAX_OUTPUT),
          exit_code: code,
        },
      });
    });

    child.on('error', (err) => {
      if (checkInterval) clearInterval(checkInterval);
      resolve({ ok: false, error: err.message });
    });
  });
}
