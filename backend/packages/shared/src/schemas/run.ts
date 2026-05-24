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

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepRunStatus = z.infer<typeof StepRunStatusSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
