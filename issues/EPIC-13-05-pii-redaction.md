# [Epic-13] PII redaction before LLM

**Labels**: `epic-13`, `good-first-issue`, `area-ai`, `stretch`
**Estimate**: 1 jam
**Depends on**: #98

## Context

Redact email, phone, NIK sebelum send ke LLM eksternal. Regex-based (good enough untuk MVP).

## Acceptance Criteria

- [ ] Function `redactPII(text: string): string`
- [ ] Redact: email, phone (Indo + intl), NIK 16-digit
- [ ] Test untuk masing-masing kategori

## Implementation Hints

```ts
// packages/ai-gateway/src/pii.ts
const PATTERNS = [
  // Email
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  // Phone (Indo: 08xx xxxx xxxx, 62xx, +62)
  { regex: /(\+?62|0)8\d{8,12}/g, replacement: '[REDACTED_PHONE]' },
  // International phone
  { regex: /\+\d{1,3}[\s-]?\d{1,4}[\s-]?\d{4,}/g, replacement: '[REDACTED_PHONE]' },
  // NIK Indonesia (16 digit)
  { regex: /\b\d{16}\b/g, replacement: '[REDACTED_ID]' },
];

export function redactPII(text: string): string {
  let redacted = text;
  for (const p of PATTERNS) {
    redacted = redacted.replace(p.regex, p.replacement);
  }
  return redacted;
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import { redactPII } from './pii.js';

describe('redactPII', () => {
  it('redacts email', () => {
    expect(redactPII('Email saya: foo@bar.com'))
      .toBe('Email saya: [REDACTED_EMAIL]');
  });

  it('redacts Indonesian phone', () => {
    expect(redactPII('HP: 081234567890')).toBe('HP: [REDACTED_PHONE]');
  });

  it('redacts NIK', () => {
    expect(redactPII('NIK: 1234567890123456')).toBe('NIK: [REDACTED_ID]');
  });

  it('passes through clean text', () => {
    expect(redactPII('Hello world')).toBe('Hello world');
  });
});
```

## Files Involved

- `packages/ai-gateway/src/pii.ts`
- Test file

## How to Verify

```bash
pnpm -F @flowforge/ai-gateway test pii
```
