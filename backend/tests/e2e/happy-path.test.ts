import { describe, it, expect, beforeAll } from 'vitest';
import WebSocket from 'ws';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WS = process.env.WS_URL ?? 'ws://localhost:3001';

describe('E2E happy path', () => {
  let token: string;
  let workflowId: string;
  let runId: string;

  beforeAll(async () => {
    // Assume seed already ran. Login.
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_slug: 'acme',
        email: 'admin@acme.com',
        password: 'password123',
      }),
    });
    expect(res.ok).toBe(true);
    token = (await res.json()).token;
  }, 30_000);

  it('create workflow', async () => {
    const definition = {
      name: 'E2E test',
      timeout_sec: 60,
      steps: [
        { id: 'wait', type: 'DELAY', depends_on: [], config: { duration_ms: 500 }, continue_on_failure: false },
        { id: 'fetch', type: 'HTTP', depends_on: ['wait'],
          config: { method: 'GET', url: 'https://httpbin.org/uuid' },
          continue_on_failure: false },
        { id: 'check', type: 'CONDITIONAL', depends_on: ['fetch'],
          config: { expr: 'true' },
          continue_on_failure: false },
      ],
    };

    const res = await fetch(`${API}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'e2e', definition }),
    });
    expect(res.status).toBe(201);
    workflowId = (await res.json()).id;
  });

  it('trigger run + websocket events', async () => {
    // Trigger
    const triggerRes = await fetch(`${API}/workflows/${workflowId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ input: {} }),
    });
    expect(triggerRes.status).toBe(202);
    runId = (await triggerRes.json()).run_id;

    // WebSocket
    const ws = new WebSocket(`${WS}/ws?token=${token}`);
    const events: any[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    ws.send(JSON.stringify({ action: 'subscribe', run_id: runId }));
    ws.on('message', (m: any) => events.push(JSON.parse(m.toString())));

    // Wait for RUN_SUCCEEDED (max 60s)
    const start = Date.now();
    while (Date.now() - start < 60_000) {
      if (events.some((e) => e.type === 'RUN_SUCCEEDED' && e.run_id === runId)) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    ws.close();

    expect(events.some((e) => e.type === 'RUN_STARTED')).toBe(true);
    expect(events.some((e) => e.type === 'STEP_STARTED' && e.step_id === 'wait')).toBe(true);
    expect(events.some((e) => e.type === 'RUN_SUCCEEDED')).toBe(true);
  }, 90_000);

  it('verify run is SUCCEEDED via API', async () => {
    const res = await fetch(`${API}/runs/${runId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.ok).toBe(true);
    const run = await res.json();
    expect(run.status).toBe('SUCCEEDED');
  });

  it('verify logs', async () => {
    const res = await fetch(`${API}/runs/${runId}/logs`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.ok).toBe(true);
    const logs = await res.json();
    expect(logs.items.length).toBeGreaterThan(0);
  });
});
