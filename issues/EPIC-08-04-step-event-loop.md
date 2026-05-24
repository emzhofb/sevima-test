# [Epic-08] Step event consumer loop

**Labels**: `epic-08`, `area-orchestrator`
**Estimate**: 1 jam
**Depends on**: #65

## Context

Orchestrator perlu loop kedua untuk konsumsi `flowforge:step-events`.

## Acceptance Criteria

- [ ] Loop `consumeStepEvents()` jalan paralel dengan `consumeRuns()`
- [ ] Parse JSON payload, panggil `handleStepEvent`
- [ ] Ack message setelah sukses

## Implementation Hints

```ts
// packages/orchestrator/src/index.ts (update)
async function consumeStepEvents(db: Db, broker: Broker, log: Logger) {
  await broker.ensureGroup('flowforge:step-events', 'orchestrator-events');

  while (running) {
    const msg = await broker.dequeue('flowforge:step-events', 'orchestrator-events', CONSUMER, 5000);
    if (!msg) continue;

    try {
      const event = {
        event_id: msg.payload.event_id,
        type: msg.payload.type as 'STEP_SUCCEEDED' | 'STEP_FAILED',
        run_id: msg.payload.run_id,
        step_id: msg.payload.step_id,
        output: msg.payload.output ? JSON.parse(msg.payload.output) : undefined,
        error: msg.payload.error,
        attempt: Number(msg.payload.attempt),
      };

      await handleStepEvent(db, broker, event);
      await broker.ack('flowforge:step-events', 'orchestrator-events', msg.id);
    } catch (err) {
      log.error({ err, msg }, 'Failed to process step event');
    }
  }
}

// In startOrchestrator():
await Promise.all([consumeRuns(...), consumeStepEvents(db, broker, log)]);
```

## Files Involved

- Update `packages/orchestrator/src/index.ts`

## How to Verify

End-to-end test: trigger run → orchestrator start → simulate worker emit event → orchestrator handle.
