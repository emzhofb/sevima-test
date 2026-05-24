import type { StepOutcome } from '../index.js';

export async function executeHttp(spec: any, _runId: string, _db: any): Promise<StepOutcome> {
  const config = spec.config;
  const timeoutSec = spec.timeout_sec ?? 30;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const response = await fetch(config.url, {
      method: config.method ?? 'GET',
      headers: config.headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown = text;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try { body = JSON.parse(text); } catch { /* keep text */ }
    }

    if (response.status >= 500) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return {
      ok: true,
      output: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      },
    };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('aborted') || msg.includes('The operation was aborted')) {
      return { ok: false, error: `Timeout after ${timeoutSec}s` };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
