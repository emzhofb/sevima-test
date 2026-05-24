# [Epic-08] Cancel handling in orchestrator

**Labels**: `epic-08`, `area-orchestrator`
**Estimate**: 1 jam
**Depends on**: #65

## Context

Saat run di-cancel via API, status sudah CANCELLED di DB. Orchestrator perlu skip incoming step events dan worker perlu check sebelum execute.

Issue ini fokus orchestrator-side: saat handle step event, kalau run sudah CANCELLED, ack message tanpa update step.

## Acceptance Criteria

- [ ] `handleStepEvent` early-return kalau `run.status` sudah terminal (CANCELLED, dll.)
- [ ] Test

## Implementation Hints

Sudah covered di handleStepEvent code di issue #65 (lihat block dengan `run.status` terminal check). Pastikan test untuk skenario ini.

```ts
it('handleStepEvent ignores event for CANCELLED run', async () => {
  // Setup run, mark CANCELLED
  await db.query("UPDATE runs SET status = 'CANCELLED' WHERE id = $1", [runId]);

  // Send STEP_SUCCEEDED event
  await handleStepEvent(db, mockBroker, {
    event_id: 'evt-1', type: 'STEP_SUCCEEDED',
    run_id: runId, step_id: 'a', attempt: 1,
  });

  // Run masih CANCELLED, tidak berubah
  const r = await getRunById(db, ..., runId);
  expect(r!.status).toBe('CANCELLED');

  // step_run tidak di-update
  // (assert based on existing setup)
});
```

## Files Involved

- Update test `packages/orchestrator/src/handle-step-event.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/orchestrator test handle-step-event
```
