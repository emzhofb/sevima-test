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
}).strict();

export const StepTypeSchema = z.enum(['HTTP', 'SCRIPT', 'DELAY', 'CONDITIONAL']);

export const StepSpecSchema = z.object({
  id: z.string().min(1).max(100),
  type: StepTypeSchema,
  depends_on: z.array(z.string()).default([]),
  config: z.record(z.unknown()),
  retry: RetryPolicySchema.optional(),
  timeout_sec: z.number().int().positive().optional(),
  continue_on_failure: z.boolean().default(false),
}).strict();

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  timeout_sec: z.number().int().positive().max(86400),
  steps: z.array(StepSpecSchema).min(1),
}).strict();

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export type StepSpec = z.infer<typeof StepSpecSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type StepType = z.infer<typeof StepTypeSchema>;
export type Role = z.infer<typeof RoleSchema>;
