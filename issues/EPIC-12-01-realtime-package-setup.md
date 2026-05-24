# [Epic-12] Realtime WebSocket package setup

**Labels**: `epic-12`, `good-first-issue`, `area-realtime`
**Estimate**: 1 jam
**Depends on**: #38 (auth)

## Context

WebSocket hub untuk push event eksekusi ke browser. Pakai `ws` library.

## Acceptance Criteria

- [ ] `packages/realtime/package.json`
- [ ] WebSocket server berjalan di port terpisah (atau attach ke API server)
- [ ] Path `/ws`

## Implementation Hints

```bash
pnpm add -F @flowforge/realtime ws @flowforge/auth
pnpm add -F @flowforge/realtime -D @types/ws
```

```ts
// packages/realtime/src/server.ts
import { WebSocketServer } from 'ws';
import { verifyJwt } from '@flowforge/auth';
import { loadConfig, createLogger } from '@flowforge/shared';

const config = loadConfig();
const log = createLogger('realtime');

const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4401, 'No token');
    return;
  }

  const claims = verifyJwt(token, config.JWT_SECRET);
  if (!claims) {
    ws.close(4401, 'Invalid token');
    return;
  }

  log.info({ tenant_id: claims.tenant_id, user_id: claims.user_id }, 'WS connected');

  // Subscription manager + heartbeat akan ditambahkan di issue lain
  ws.on('close', () => log.info({ tenant_id: claims.tenant_id }, 'WS disconnected'));
});

log.info('Realtime server listening on :3001');
```

## Files Involved

- `packages/realtime/package.json`
- `packages/realtime/src/server.ts`

## How to Verify

```bash
pnpm -F @flowforge/realtime dev
# Connect dengan wscat:
wscat -c "ws://localhost:3001/ws?token=$JWT"
```
