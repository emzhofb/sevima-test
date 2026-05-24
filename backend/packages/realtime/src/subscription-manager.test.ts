import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager } from './subscription-manager.js';

describe('SubscriptionManager', () => {
  it('broadcasts only to matching tenant', () => {
    const manager = new SubscriptionManager();
    const sentA: any[] = [];
    const sentB: any[] = [];
    const wsA = { send: (m: string) => sentA.push(JSON.parse(m)) } as any;
    const wsB = { send: (m: string) => sentB.push(JSON.parse(m)) } as any;

    const connA = { ws: wsA, tenant_id: 't1', user_id: 'u1', subscribed_runs: new Set<string>() };
    const connB = { ws: wsB, tenant_id: 't2', user_id: 'u2', subscribed_runs: new Set<string>() };

    manager.register(connA);
    manager.register(connB);

    manager.broadcast({ tenant_id: 't1', run_id: 'r1', type: 'STEP_SUCCEEDED', payload: {} });

    expect(sentA.length).toBe(1);
    expect(sentA[0].run_id).toBe('r1');
    expect(sentB.length).toBe(0);
  });

  it('broadcasts based on run subscription filter when set', () => {
    const manager = new SubscriptionManager();
    const sent = new Map<string, any[]>();
    const createWs = (id: string) => ({
      send: (m: string) => {
        const list = sent.get(id) || [];
        list.push(JSON.parse(m));
        sent.set(id, list);
      }
    } as any);

    const conn1 = { ws: createWs('conn1'), tenant_id: 't1', user_id: 'u1', subscribed_runs: new Set<string>() };
    const conn2 = { ws: createWs('conn2'), tenant_id: 't1', user_id: 'u2', subscribed_runs: new Set<string>() };

    manager.register(conn1);
    manager.register(conn2);

    manager.subscribeRun(conn2, 'run-foo');

    // Broadcast event for run-bar
    manager.broadcast({ tenant_id: 't1', run_id: 'run-bar', type: 'STEP_STARTED' });
    // conn1 has empty subscribed_runs (gets everything), conn2 is subscribed to run-foo (should not get this)
    expect(sent.get('conn1')?.length).toBe(1);
    expect(sent.get('conn2')?.length).toBeUndefined();

    // Broadcast event for run-foo
    manager.broadcast({ tenant_id: 't1', run_id: 'run-foo', type: 'STEP_STARTED' });
    expect(sent.get('conn1')?.length).toBe(2);
    expect(sent.get('conn2')?.length).toBe(1);
  });
});
