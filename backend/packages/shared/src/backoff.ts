import type { RetryPolicy } from './schemas/workflow.js';

export function computeBackoff(attempt: number, policy: RetryPolicy): number {
  if (attempt < 1) {
    throw new Error('attempt must be >= 1');
  }

  if (policy.backoff_base_ms <= 0) {
    throw new Error('backoff_base_ms must be > 0');
  }

  const exponential = policy.backoff_base_ms * 2 ** (attempt - 1);
  const capped = Math.min(exponential, policy.backoff_max_ms);

  if (policy.jitter) {
    return Math.floor(Math.random() * capped);
  }

  return capped;
}