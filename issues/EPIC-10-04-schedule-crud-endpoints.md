# [Epic-10] Schedule CRUD endpoints

**Labels**: `epic-10`, `good-first-issue`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #84

## Context

API untuk manage schedule.

## Acceptance Criteria

- [ ] `POST /workflows/:id/schedules` body: `{ cron_expr, tz?, enabled? }`
- [ ] `GET /workflows/:id/schedules`
- [ ] `DELETE /schedules/:id`
- [ ] `PATCH /schedules/:id` body: `{ enabled? }`
- [ ] Role: ADMIN/EDITOR

## Implementation Hints

Validate cron expression saat create:

```ts
import cronParser from 'cron-parser';

function validateCron(expr: string): boolean {
  try { cronParser.parseExpression(expr); return true; }
  catch { return false; }
}

const CreateScheduleSchema = z.object({
  cron_expr: z.string().refine(validateCron, 'Invalid cron expression'),
  tz: z.string().default('UTC'),
  enabled: z.boolean().default(true),
});
```

Implement endpoint pattern sama seperti workflow CRUD.

## Files Involved

- `packages/api/src/routes/schedules.ts`
- `packages/api/src/repos/schedule.repo.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/api test schedules
```
