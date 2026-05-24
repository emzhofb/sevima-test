# [Epic-12] WebSocket subscription manager

**Labels**: `epic-12`, `area-realtime`
**Estimate**: 2 jam
**Depends on**: #89

## Context

Track active connections per tenant_id. Saat event diterima dari Redis pub/sub, broadcast ke connection yang relevan.

## Acceptance Criteria

- [ ] `SubscriptionManager` class dengan `register`, `unregister`, `broadcast`
- [ ] Broadcast filter by `tenant_id`
- [ ] Test unit (tanpa real WS)

## Implementation Hints

```ts
// packages/realtime/src/subscription-manager.ts
import type { WebSocket } from 'ws';

type Connection = {
  ws: WebSocket;
  tenant_id: string;
  user_id: string;
  subscribed_runs: Set<string>; // run_ids client subscribed to
};

export class SubscriptionManager {
  private connections = new Set<Connection>();

  register(conn: Connection): void {
    this.connections.add(conn);
  }

  unregister(conn: Connection): void {
    this.connections.delete(conn);
  }

  subscribeRun(conn: Connection, runId: string): void {
    conn.subscribed_runs.add(runId);
  }

  unsubscribeRun(conn: Connection, runId: string): void {
    conn.subscribed_runs.delete(runId);
  }

  broadcast(event: { tenant_id: string; run_id: string; type: string; payload: unknown }): void {
    const message = JSON.stringify(event);
    for (const conn of this.connections) {
      if (conn.tenant_id !== event.tenant_id) continue;
      if (conn.subscribed_runs.size > 0 && !conn.subscribed_runs.has(event.run_id)) continue;
      try {
        conn.ws.send(message);
      } catch (err) {
        // ignore failed sends; conn will be cleaned on next close
      }
    }
  }

  size(): number {
    return this.connections.size;
  }
}
```

Test:

```ts
it('broadcasts only to matching tenant', () => {
  const manager = new SubscriptionManager();
  const sentA: any[] = [], sentB: any[] = [];
  const wsA = { send: (m: string) => sentA.push(JSON.parse(m)) } as any;
  const wsB = { send: (m: string) => sentB.push(JSON.parse(m)) } as any;

  manager.register({ ws: wsA, tenant_id: 't1', user_id: 'u1', subscribed_runs: new Set() });
  manager.register({ ws: wsB, tenant_id: 't2', user_id: 'u2', subscribed_runs: new Set() });

  manager.broadcast({ tenant_id: 't1', run_id: 'r1', type: 'STEP_SUCCEEDED', payload: {} });

  expect(sentA.length).toBe(1);
  expect(sentB.length).toBe(0);
});
```

## Files Involved

- `packages/realtime/src/subscription-manager.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/realtime test
```
