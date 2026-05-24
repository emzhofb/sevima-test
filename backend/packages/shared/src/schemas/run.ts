import { z } from 'zod';

export const RunStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
]);

export const StepRunStatusSchema = z.enum([
  'PENDING',
  'READY',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
]);

export const TriggerTypeSchema = z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK']);

export const RunSchema = z
  .object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    workflow_id: z.string().uuid(),
    version_id: z.string().uuid(),
    status: RunStatusSchema,
    input: z.record(z.unknown()),
    trigger_type: TriggerTypeSchema,
    started_at: z.date().nullable(),
    finished_at: z.date().nullable(),
    created_at: z.date(),
  })
  .strict();

export const StepRunSchema = z
  .object({
    id: z.string().uuid(),
    run_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    step_id: z.string().min(1).max(100),
    status: StepRunStatusSchema,
    attempt: z.number().int().positive(),
    output: z.record(z.unknown()).nullable(),
    error: z.string().nullable(),
    started_at: z.date().nullable(),
    finished_at: z.date().nullable(),
    last_heartbeat_at: z.date().nullable(),
  })
  .strict();

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepRunStatus = z.infer<typeof StepRunStatusSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type Run = z.infer<typeof RunSchema>;
export type StepRun = z.infer<typeof StepRunSchema>;
