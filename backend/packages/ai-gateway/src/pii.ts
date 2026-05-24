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
