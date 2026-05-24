import { z } from 'zod';

export const HttpStepConfigSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
}).strict();

export const ScriptStepConfigSchema = z.object({
  language: z.enum(['javascript', 'python']).default('javascript'),
  code: z.string().min(1),
}).strict();

export const DelayStepConfigSchema = z.object({
  duration_ms: z.number().int().positive().max(3_600_000), // max 1 jam
}).strict();

export const ConditionalStepConfigSchema = z.object({
  expr: z.string().min(1),
}).strict();

// Validate config against step type
export function validateStepConfig(
  type: 'HTTP' | 'SCRIPT' | 'DELAY' | 'CONDITIONAL',
  config: unknown,
) {
  switch (type) {
    case 'HTTP': return HttpStepConfigSchema.safeParse(config);
    case 'SCRIPT': return ScriptStepConfigSchema.safeParse(config);
    case 'DELAY': return DelayStepConfigSchema.safeParse(config);
    case 'CONDITIONAL': return ConditionalStepConfigSchema.safeParse(config);
  }
}
