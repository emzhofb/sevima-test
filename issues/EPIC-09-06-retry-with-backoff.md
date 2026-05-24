# [Epic-09] Retry with backoff in worker

**Labels**: `epic-09`, `area-worker`
**Estimate**: 1.5 jam
**Depends on**: #71, #36 (computeBackoff)

## Context

Saat step gagal dan masih punya retry budget, schedule re-enqueue dengan backoff delay. Update step_run `attempt`.

## Acceptance Criteria

- [ ] Worker check `attempt < retry.max_attempts` saat gagal
- [ ] Jika ya: setTimeout untuk re-enqueue dengan delay = computeBackoff(attempt + 1)
- [ ] Jika tidak: emit STEP_FAILED event
- [ ] Test

## Implementation Hints

Update worker loop:

```ts
import { computeBackoff } from '@flowforge/shared';

// Saat outcome adalah failure:
if (!outcome.ok) {
  const stepSpec = ...;
  const retry = stepSpec.retry;
  const currentAttempt = Number(attempt);

  if (retry && currentAttempt < retry.max_attempts) {
    const delay = computeBackoff(currentAttempt + 1, retry);

    // Update step_run attempt + status READY
    await db.query(
      `UPDATE step_runs SET attempt = $1, status = 'READY' WHERE run_id = $2 AND step_id = $3`,
      [currentAttempt + 1, run_id, step_id],
    );

    // Re-enqueue with delay
    setTimeout(() => {
      broker.enqueue(STEP_STREAM, {
        run_id, step_id,
        tenant_id: tenantId,
        attempt: String(currentAttempt + 1),
      }).catch((err) => log.error({ err }, 'Re-enqueue failed'));
    }, delay);

    await broker.ack(STEP_STREAM, GROUP, msg.id);
    continue;
  }

  // Out of retries: emit STEP_FAILED
  await broker.enqueue(EVENT_STREAM, {
    event_id: eventId,
    type: 'STEP_FAILED',
    run_id, step_id, attempt: String(currentAttempt),
    tenant_id: tenantId,
    error: outcome.error,
  });
}
```

Test:

```ts
it('retries on failure with backoff', async () => {
  // Setup workflow with HTTP step that fails 2x then succeeds
  // Trigger run, simulate worker
  // After 3 attempts, run should be SUCCEEDED
});

it('marks failed after max_attempts', async () => {
  // Setup HTTP step that always fails, max_attempts=2
  // Trigger run, simulate worker
  // After 2 attempts, run should be FAILED
});
```

## Files Involved

- Update `packages/worker/src/index.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/worker test retry
```
