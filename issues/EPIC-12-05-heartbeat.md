# [Epic-12] WebSocket heartbeat (ping/pong)

**Labels**: `epic-12`, `good-first-issue`, `area-realtime`
**Estimate**: 1 jam
**Depends on**: #89

## Context

Detect dead connections dengan ping setiap 30 detik. Close kalau tidak pong dalam 60 detik.

## Acceptance Criteria

- [ ] Server kirim ping setiap 30 detik
- [ ] Tutup koneksi yang tidak respond pong dalam 60 detik
- [ ] Cleanup dari subscription manager

## Implementation Hints

```ts
// In server.ts
const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 60_000;

wss.on('connection', (ws, req) => {
  // ... auth setup

  let isAlive = true;
  let lastPong = Date.now();

  ws.on('pong', () => {
    isAlive = true;
    lastPong = Date.now();
  });

  const interval = setInterval(() => {
    if (Date.now() - lastPong > HEARTBEAT_TIMEOUT) {
      ws.terminate();
      clearInterval(interval);
      return;
    }
    if (!isAlive) {
      // ws never replied to last ping
    }
    isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);

  ws.on('close', () => {
    clearInterval(interval);
    manager.unregister(conn);
  });
});
```

## Files Involved

- Update `packages/realtime/src/server.ts`

## How to Verify

Manual: connect via wscat, leave idle 90 seconds, observe disconnect after timeout.
