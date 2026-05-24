# [Epic-03] Parse JSON and YAML input

**Labels**: `epic-03`, `area-parser`
**Estimate**: 2 jam
**Depends on**: #26

## Context

Parser harus accept JSON dan YAML, validate dengan zod schema, kemudian validate DAG.

## Acceptance Criteria

- [ ] Function `parseFromJson(input: string): ParseResult`
- [ ] Function `parseFromYaml(input: string): ParseResult`
- [ ] Function `parse(input: string): ParseResult` (auto-detect)
- [ ] Reject input > 5 MB dengan error `input_too_large`
- [ ] Reject input > 1000 steps dengan error `input_too_large`
- [ ] Schema error mapped ke `ValidationError` dengan issue category yang sesuai

## Implementation Hints

```bash
pnpm add -F @flowforge/parser yaml
```

```ts
// packages/parser/src/parser.ts
import { parse as parseYaml } from 'yaml';
import { WorkflowDefinitionSchema, type WorkflowDefinition } from '@flowforge/shared';
import { validateAndSortDAG } from './validate.js';
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

function parseObject(parsed: unknown): ParseResult {
  const stepCountError = checkStepCount(parsed);
  if (stepCountError) return { ok: false, errors: [stepCountError] };

  const result = WorkflowDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    const errors: ValidationError[] = result.error.issues.map((iss) => ({
      step_id: extractStepIdFromPath(iss.path),
      issue: mapZodIssue(iss.code),
      message: iss.message,
    }));
    return { ok: false, errors };
  }

  const dagResult = validateAndSortDAG(result.data);
  if (!dagResult.ok) return { ok: false, errors: dagResult.errors };

  return { ok: true, definition: result.data, sorted: dagResult.sorted };
}

function extractStepIdFromPath(path: (string | number)[]): string | null {
  // path mungkin: ['steps', 2, 'depends_on'] -> step index 2, kita tidak punya id, return null
  // atau: ['name'] -> return null
  return null;
}

function mapZodIssue(code: string): ValidationError['issue'] {
  switch (code) {
    case 'unrecognized_keys': return 'unknown_field';
    case 'invalid_type': return 'type_mismatch';
    case 'too_small':
    case 'too_big':
      return 'out_of_range';
    case 'invalid_enum_value': return 'unknown_step_type';
    default: return 'missing_required';
  }
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
  // Heuristic: starts with `{` -> JSON, else YAML
  return trimmed.startsWith('{') ? parseFromJson(input) : parseFromYaml(input);
}
```

Test cases:

```ts
describe('parse', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify({
      name: 'test',
      timeout_sec: 60,
      steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { ms: 100 } }],
    });
    const result = parse(json);
    expect(result.ok).toBe(true);
  });

  it('rejects input > 5 MB', () => {
    const huge = '{' + 'a'.repeat(6 * 1024 * 1024) + '}';
    const result = parse(huge);
    expect(result.ok).toBe(false);
  });

  it('rejects > 1000 steps', () => {
    const def = {
      name: 'test',
      timeout_sec: 60,
      steps: Array.from({ length: 1001 }, (_, i) => ({
        id: `s${i}`, type: 'DELAY', depends_on: [], config: { ms: 100 },
      })),
    };
    const result = parse(JSON.stringify(def));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].issue).toBe('input_too_large');
  });
});
```

## Files Involved

- `packages/parser/src/parser.ts`
- `packages/parser/src/parser.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser test parser
```
