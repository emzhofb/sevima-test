# [Epic-12] Subscribe / unsubscribe messages from client

**Labels**: `epic-12`, `area-realtime`
**Estimate**: 1.5 jam
**Depends on**: #91

## Context

Client kirim `{ "action": "subscribe", "run_id": "..." }` untuk subscribe ke run tertentu. Server check ownership lewat DB query.

## Acceptance Criteria

- [ ] Server handle message `{ action: "subscribe", run_id }`
- [ ] Server handle message `{ action: "unsubscribe", run_id }`
- [ ] Verify run.tenant_id = connection.tenant_id sebelum subscribe
- [ ] Send ack message ke client

## Implementation Hints

```ts
ws.on('message', async (raw) => {
  let msg: any;
  try { msg = JSON.parse(raw.toString()); }
  catch { return ws.send(JSON.stringify({ error: 'invalid_json' })); }

  if (msg.action === 'subscribe' && typeof msg.run_id === 'string') {
    // Verify ownership
    const res = await db.query(
      'SELECT id FROM runs WHERE id = $1 AND tenant_id = $2',
      [msg.run_id, claims.tenant_id],
    );
    if (res.rows.length === 0) {
      return ws.send(JSON.stringify({ error: 'run_not_found' }));
    }
    manager.subscribeRun(conn, msg.run_id);
    ws.send(JSON.stringify({ subscribed: msg.run_id }));
  } else if (msg.action === 'unsubscribe' && typeof msg.run_id === 'string') {
    manager.unsubscribeRun(conn, msg.run_id);
    ws.send(JSON.stringify({ unsubscribed: msg.run_id }));
  }
});
```

## Files Involved

- Update `packages/realtime/src/server.ts`

## How to Verify

```bash
wscat -c "ws://localhost:3001/ws?token=$JWT"
> {"action":"subscribe","run_id":"<run-id>"}
< {"subscribed":"<run-id>"}
```
