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
