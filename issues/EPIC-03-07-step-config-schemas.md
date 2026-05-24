# [Epic-03] Step-type-specific config schemas (HTTP, SCRIPT, DELAY, CONDITIONAL)

**Labels**: `epic-03`, `area-parser`
**Estimate**: 1.5 jam
**Depends on**: #16

## Context

Setiap `StepSpec.type` punya bentuk `config` berbeda. Validasi tipe spesifik agar tidak ditolak di runtime.

## Acceptance Criteria

- [ ] Schema spesifik untuk masing-masing tipe step
- [ ] Validasi `config` sesuai `type` (discriminated union)
- [ ] Test untuk konfigurasi valid + invalid per tipe

## Implementation Hints

```ts
// packages/parser/src/step-configs.ts
import { z } from 'zod';

export const HttpStepConfigSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export const ScriptStepConfigSchema = z.object({
  language: z.enum(['javascript', 'python']).default('javascript'),
  code: z.string().min(1),
});

export const DelayStepConfigSchema = z.object({
  duration_ms: z.number().int().positive().max(3_600_000), // max 1 jam
});

export const ConditionalStepConfigSchema = z.object({
  expr: z.string().min(1),
});

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
```

Update parser untuk panggil validateStepConfig setelah top-level schema lulus.

## Files Involved

- `packages/parser/src/step-configs.ts`
- `packages/parser/src/step-configs.test.ts`
- Update `packages/parser/src/parser.ts` untuk integrate

## How to Verify

```bash
pnpm -F @flowforge/parser test step-configs
```
