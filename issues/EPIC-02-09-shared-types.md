# [Epic-02] Shared TypeScript types for domain entities

**Labels**: `epic-02`, `good-first-issue`, `area-shared`
**Estimate**: 2 jam
**Depends on**: #6 (config)

## Context

Definisikan tipe TypeScript dan zod schema untuk semua entitas domain (Tenant, User, Workflow, dst.) di `packages/shared`. Ini akan dipakai semua service.

## Acceptance Criteria

- [ ] File `packages/shared/src/types/index.ts` dengan semua type
- [ ] File `packages/shared/src/schemas/index.ts` dengan zod schemas
- [ ] Type derived dari schema pakai `z.infer<typeof XSchema>`
- [ ] Test untuk validation rule (slug regex, retry max 1-10, dst.)

## Implementation Hints

`packages/shared/src/schemas/workflow.ts`:

```ts
import { z } from 'zod';

export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Invalid slug format');

export const RoleSchema = z.enum(['ADMIN', 'EDITOR', 'VIEWER']);

export const RetryPolicySchema = z.object({
  max_attempts: z.number().int().min(1).max(10),
  backoff_base_ms: z.number().int().positive(),
  backoff_max_ms: z.number().int().positive(),
  jitter: z.boolean().default(true),
});

export const StepTypeSchema = z.enum(['HTTP', 'SCRIPT', 'DELAY', 'CONDITIONAL']);

export const StepSpecSchema = z.object({
  id: z.string().min(1).max(100),
  type: StepTypeSchema,
  depends_on: z.array(z.string()).default([]),
  config: z.record(z.unknown()),
  retry: RetryPolicySchema.optional(),
  timeout_sec: z.number().int().positive().optional(),
  continue_on_failure: z.boolean().default(false),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  timeout_sec: z.number().int().positive().max(86400),
  steps: z.array(StepSpecSchema).min(1),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export type StepSpec = z.infer<typeof StepSpecSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
```

`packages/shared/src/schemas/run.ts`:

```ts
import { z } from 'zod';

export const RunStatusSchema = z.enum([
  'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT',
]);
export const StepRunStatusSchema = z.enum([
  'PENDING', 'READY', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED',
]);
export const TriggerTypeSchema = z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK']);

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepRunStatus = z.infer<typeof StepRunStatusSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
```

Test file `packages/shared/src/schemas/workflow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SlugSchema, RetryPolicySchema, WorkflowDefinitionSchema } from './workflow.js';

describe('SlugSchema', () => {
  it.each([
    ['valid-slug', true],
    ['acme-corp', true],
    ['acme', true],
    ['Acme', false],
    ['-bad', false],
    ['too-long-' + 'a'.repeat(60), false],
  ])('slug %s -> %s', (slug, valid) => {
    expect(SlugSchema.safeParse(slug).success).toBe(valid);
  });
});

describe('RetryPolicySchema', () => {
  it('rejects max_attempts > 10', () => {
    expect(
      RetryPolicySchema.safeParse({
        max_attempts: 11,
        backoff_base_ms: 100,
        backoff_max_ms: 1000,
        jitter: true,
      }).success,
    ).toBe(false);
  });

  it('rejects max_attempts < 1', () => {
    expect(
      RetryPolicySchema.safeParse({
        max_attempts: 0,
        backoff_base_ms: 100,
        backoff_max_ms: 1000,
        jitter: true,
      }).success,
    ).toBe(false);
  });
});
```

## Files Involved

- `packages/shared/src/schemas/workflow.ts`
- `packages/shared/src/schemas/run.ts`
- `packages/shared/src/schemas/user.ts`
- `packages/shared/src/schemas/index.ts`
- Test files

## How to Verify

```bash
pnpm -F @flowforge/shared test
```
