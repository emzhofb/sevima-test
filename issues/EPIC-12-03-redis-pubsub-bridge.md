# [Epic-12] Redis pub/sub bridge for events

**Labels**: `epic-12`, `area-realtime`
**Estimate**: 1.5 jam
**Depends on**: #90

## Context

Worker / orchestrator publish event ke Redis pub/sub channel `flowforge:events`. Realtime service subscribe channel ini, broadcast ke WebSocket clients.

## Acceptance Criteria

- [ ] Realtime service subscribe Redis channel
- [ ] Worker / orchestrator helper `publishEvent` untuk push event
- [ ] Test: publish → realtime broadcast → client receive

## Implementation Hints

```ts
// packages/shared/src/events.ts
import type { Redis } from 'ioredis';

export type RealtimeEvent = {
  tenant_id: string;
  run_id: string;
  type: 'RUN_QUEUED' | 'RUN_STARTED' | 'STEP_STARTED' | 'STEP_SUCCEEDED' | 'STEP_FAILED' | 'RUN_SUCCEEDED' | 'RUN_FAILED' | 'RUN_TIMED_OUT' | 'RUN_CANCELLED';
  step_id?: string;
  ts: number;
  payload?: unknown;
};

export async function publishEvent(redis: Redis, event: RealtimeEvent): Promise<void> {
  await redis.publish('flowforge:events', JSON.stringify(event));
}
```

```ts
// packages/realtime/src/server.ts (update)
import Redis from 'ioredis';
import { SubscriptionManager } from './subscription-manager.js';

const subscriber = new Redis(config.REDIS_URL);
const manager = new SubscriptionManager();

await subscriber.subscribe('flowforge:events');
subscriber.on('message', (channel, message) => {
  if (channel !== 'flowforge:events') return;
  try {
    const event = JSON.parse(message);
    manager.broadcast(event);
  } catch (err) {
    log.error({ err }, 'Failed to parse event');
  }
});
```

Wire ke worker dan orchestrator:

```ts
// In handleStepEvent.ts (orchestrator):
import { publishEvent } from '@flowforge/shared';

// Setelah update DB:
await publishEvent(redis, {
  tenant_id, run_id, step_id,
  type: outcome.ok ? 'STEP_SUCCEEDED' : 'STEP_FAILED',
  ts: Date.now(),
});

// Saat run final:
await publishEvent(redis, { tenant_id, run_id, type: 'RUN_SUCCEEDED', ts: Date.now() });
```

## Files Involved

- `packages/shared/src/events.ts`
- Update `packages/realtime/src/server.ts`
- Update orchestrator + worker untuk publish

## How to Verify

Manual test: connect WebSocket dari browser console, trigger run, lihat events streaming.
