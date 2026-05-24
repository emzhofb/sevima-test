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
