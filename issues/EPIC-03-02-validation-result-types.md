# [Epic-03] Validation result types and error taxonomy

**Labels**: `epic-03`, `good-first-issue`, `area-parser`
**Estimate**: 0.5 jam
**Depends on**: #24

## Context

Definisi tipe error untuk parser/validator. Sesuai requirement: error taxonomy `cycle | dangling_dependency | duplicate_id | unknown_field | type_mismatch | missing_required | out_of_range | unknown_step_type | input_too_large`.

## Acceptance Criteria

- [ ] `packages/parser/src/types.ts` ekspor `ValidationResult`, `ValidationError`, `ValidationIssue`
- [ ] Issue type adalah union literal sesuai taxonomy

## Implementation Hints

```ts
// packages/parser/src/types.ts
export type ValidationIssue =
  | 'cycle'
  | 'dangling_dependency'
  | 'duplicate_id'
  | 'unknown_field'
  | 'type_mismatch'
  | 'missing_required'
  | 'out_of_range'
  | 'unknown_step_type'
  | 'input_too_large';

export type ValidationError = {
  step_id: string | null; // null jika error pada level DAG keseluruhan
  issue: ValidationIssue;
  message: string;
};

export type ValidationResult =
  | { ok: true; sorted: string[] }
  | { ok: false; errors: ValidationError[] };
```

## Files Involved

- `packages/parser/src/types.ts`

## How to Verify

```bash
pnpm -F @flowforge/parser typecheck
```
