# [Epic-12] Realtime integration test

**Labels**: `epic-12`, `area-testing`
**Estimate**: 1.5 jam
**Depends on**: #91, #92

## Context

End-to-end test: connect WS, subscribe run, trigger run via API, verify event diterima.

## Acceptance Criteria

- [ ] Test menyalakan realtime + worker + orchestrator (atau mock)
- [ ] Connect 2 WS dari 2 tenant berbeda
- [ ] Trigger run di tenant A
- [ ] Verify hanya WS tenant A yang menerima event

## Implementation Hints

```ts
import WebSocket from 'ws';

it('cross-tenant isolation: tenant B does not receive A events', async () => {
  // Setup 2 tenants, 2 tokens
  const wsA = new WebSocket(`ws://localhost:3001/ws?token=${tokenA}`);
  const wsB = new WebSocket(`ws://localhost:3001/ws?token=${tokenB}`);

  await Promise.all([
    new Promise<void>((r) => wsA.on('open', r)),
    new Promise<void>((r) => wsB.on('open', r)),
  ]);

  const eventsA: any[] = [];
  const eventsB: any[] = [];
  wsA.on('message', (m) => eventsA.push(JSON.parse(m.toString())));
  wsB.on('message', (m) => eventsB.push(JSON.parse(m.toString())));

  // Trigger run di tenant A
  // Wait for events
  await new Promise((r) => setTimeout(r, 2000));

  // Verify
  expect(eventsA.some((e) => e.type === 'RUN_STARTED')).toBe(true);
  expect(eventsB.length).toBe(0);

  wsA.close(); wsB.close();
});
```

## Files Involved

- `packages/realtime/src/integration.test.ts`

## How to Verify

```bash
docker compose up -d
pnpm migrate:up
pnpm dev:all  # script that runs all services
pnpm -F @flowforge/realtime test integration
```
