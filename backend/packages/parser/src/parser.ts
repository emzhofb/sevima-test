import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { WorkflowDefinitionSchema, type WorkflowDefinition } from '@flowforge/shared';
import { validateAndSortDAG } from './validate.js';
import { validateStepConfig } from './step-configs.js';
import type { ValidationResult, ValidationError } from './types.js';

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_STEPS = 1000;

export type ParseResult =
  | { ok: true; definition: WorkflowDefinition; sorted: string[] }
  | { ok: false; errors: ValidationError[] };

function checkSize(input: string): ValidationError | null {
  if (Buffer.byteLength(input, 'utf-8') > MAX_INPUT_BYTES) {
    return {
      step_id: null,
      issue: 'input_too_large',
      message: `Input exceeds ${MAX_INPUT_BYTES} bytes`,
    };
  }
  return null;
}

function checkStepCount(parsed: unknown): ValidationError | null {
  const steps = (parsed as { steps?: unknown[] })?.steps;
  if (Array.isArray(steps) && steps.length > MAX_STEPS) {
    return {
      step_id: null,
      issue: 'input_too_large',
      message: `Workflow has ${steps.length} steps (max ${MAX_STEPS})`,
    };
  }
  return null;
}

function extractStepIdFromPath(path: (string | number)[], parsed: unknown): string | null {
  if (path[0] === 'steps' && typeof path[1] === 'number') {
    const steps = (parsed as { steps?: unknown[] })?.steps;
    if (Array.isArray(steps)) {
      const step = steps[path[1]];
      if (step && typeof step === 'object' && 'id' in step) {
        return String((step as { id: unknown }).id);
      }
    }
  }
  return null;
}

function mapZodIssue(iss: z.ZodIssue): ValidationError['issue'] {
  switch (iss.code) {
    case 'unrecognized_keys':
      return 'unknown_field';
    case 'invalid_type':
      if (iss.received === 'undefined') {
        return 'missing_required';
      }
      return 'type_mismatch';
    case 'too_small':
    case 'too_big':
      return 'out_of_range';
    case 'invalid_enum_value':
      if (iss.path.includes('type')) {
        return 'unknown_step_type';
      }
      return 'type_mismatch';
    default:
      return 'missing_required';
  }
}

function parseObject(parsed: unknown): ParseResult {
  const stepCountError = checkStepCount(parsed);
  if (stepCountError) return { ok: false, errors: [stepCountError] };

  const result = WorkflowDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    const errors: ValidationError[] = result.error.issues.map((iss) => ({
      step_id: extractStepIdFromPath(iss.path, parsed),
      issue: mapZodIssue(iss),
      message: iss.message,
    }));
    return { ok: false, errors };
  }

  const definition = result.data;
  const errors: ValidationError[] = [];

  // Validate step-specific configs
  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i]!;
    const configResult = validateStepConfig(step.type, step.config);
    if (!configResult.success) {
      for (const iss of configResult.error.issues) {
        errors.push({
          step_id: step.id,
          issue: mapZodIssue(iss),
          message: `Step '${step.id}' config error: ${iss.message}`,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const dagResult = validateAndSortDAG(definition);
  if (!dagResult.ok) return { ok: false, errors: dagResult.errors };

  return { ok: true, definition, sorted: dagResult.sorted };
}

export function parseFromJson(input: string): ParseResult {
  const sizeError = checkSize(input);
  if (sizeError) return { ok: false, errors: [sizeError] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    return {
      ok: false,
      errors: [{ step_id: null, issue: 'type_mismatch', message: `Invalid JSON: ${(err as Error).message}` }],
    };
  }

  return parseObject(parsed);
}

export function parseFromYaml(input: string): ParseResult {
  const sizeError = checkSize(input);
  if (sizeError) return { ok: false, errors: [sizeError] };

  let parsed: unknown;
  try {
    parsed = parseYaml(input);
  } catch (err) {
    return {
      ok: false,
      errors: [{ step_id: null, issue: 'type_mismatch', message: `Invalid YAML: ${(err as Error).message}` }],
    };
  }

  return parseObject(parsed);
}

export function parse(input: string): ParseResult {
  const trimmed = input.trim();
  return trimmed.startsWith('{') ? parseFromJson(input) : parseFromYaml(input);
}
