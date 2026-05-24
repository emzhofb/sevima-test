// Set fallback environment variables for config loading during test imports
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://flowforge:flowforge@localhost:5432/flowforge';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(32);

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import RedisMock from 'ioredis-mock';
import { signJwt } from '@flowforge/auth';
import { createRealtimeServer } from './server.js';
import { loadConfig } from '@flowforge/shared';

const config = loadConfig();

describe('Realtime WebSocket E2E Integration', () => {
  let server: any;
  let redisPub: any;
  let redisSub: any;
  let mockDb: any;
  const PORT = 3002;

  const tenantA = 'tenant-A';
  const tenantB = 'tenant-B';
  const tokenA = signJwt({ tenant_id: tenantA, user_id: 'user-1', role: 'EDITOR' }, config.JWT_SECRET);
  const tokenB = signJwt({ tenant_id: tenantB, user_id: 'user-2', role: 'EDITOR' }, config.JWT_SECRET);

  beforeAll(async () => {
    redisPub = new RedisMock();
    redisSub = new RedisMock();

    mockDb = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const runId = params?.[0];
        const tenantId = params?.[1];

        if (runId === 'run-1' && tenantId === tenantA) {
          return { rows: [{ id: 'run-1' }] };
        }
        return { rows: [] };
      }),
    };

    server = createRealtimeServer({
      port: PORT,
      db: mockDb,
      redis: redisSub,
    });
  });

  afterAll(async () => {
    server.wss.close();
    redisPub.disconnect();
    redisSub.disconnect();
  });

  it('cross-tenant isolation: tenant B does not receive tenant A events', async () => {
    const wsA = new WebSocket(`ws://localhost:${PORT}/ws?token=${tokenA}`);
    const wsB = new WebSocket(`ws://localhost:${PORT}/ws?token=${tokenB}`);

    await Promise.all([
      new Promise<void>((r) => wsA.on('open', r)),
      new Promise<void>((r) => wsB.on('open', r)),
    ]);

    const eventsA: any[] = [];
    const eventsB: any[] = [];

    wsA.on('message', (m) => eventsA.push(JSON.parse(m.toString())));
    wsB.on('message', (m) => eventsB.push(JSON.parse(m.toString())));

    wsA.send(JSON.stringify({ action: 'subscribe', run_id: 'run-1' }));
    wsB.send(JSON.stringify({ action: 'subscribe', run_id: 'run-1' }));

    await new Promise((r) => setTimeout(r, 200));

    expect(eventsA).toContainEqual({ subscribed: 'run-1' });
    expect(eventsB).toContainEqual({ error: 'run_not_found' });

    eventsA.length = 0;
    eventsB.length = 0;

    const event = {
      tenant_id: tenantA,
      run_id: 'run-1',
      type: 'RUN_STARTED',
      ts: Date.now(),
    };
    await redisPub.publish('flowforge:events', JSON.stringify(event));

    await new Promise((r) => setTimeout(r, 200));

    expect(eventsA.some((e) => e.type === 'RUN_STARTED')).toBe(true);
    expect(eventsB.length).toBe(0);

    wsA.close();
    wsB.close();
  });

  it('heartbeat timeout scenario: client is disconnected if no pong response is received', async () => {
    const shortPort = 3009;
    const shortServer = createRealtimeServer({
      port: shortPort,
      db: mockDb,
      redis: redisSub,
      heartbeatInterval: 50,
      heartbeatTimeout: 100,
    });

    const ws = new WebSocket(`ws://localhost:${shortPort}/ws?token=${tokenA}`);
    ws.pong = () => {}; // Disable client-side auto-pong reply

    await new Promise<void>((r) => ws.on('open', r));

    const closed = await new Promise<boolean>((resolve) => {
      ws.on('close', () => resolve(true));
      setTimeout(() => resolve(false), 500);
    });

    expect(closed).toBe(true);
    shortServer.wss.close();
  });
});
