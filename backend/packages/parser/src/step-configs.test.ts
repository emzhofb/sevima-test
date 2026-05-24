import { describe, it, expect } from 'vitest';
import { validateStepConfig } from './step-configs.js';

describe('validateStepConfig', () => {
  describe('HTTP', () => {
    it('accepts valid HTTP config', () => {
      const res = validateStepConfig('HTTP', {
        method: 'POST',
        url: 'https://example.com/api',
        headers: { 'Content-Type': 'application/json' },
        body: { foo: 'bar' },
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid HTTP method', () => {
      const res = validateStepConfig('HTTP', {
        method: 'INVALID',
        url: 'https://example.com',
      });
      expect(res.success).toBe(false);
    });

    it('rejects invalid HTTP URL', () => {
      const res = validateStepConfig('HTTP', {
        method: 'GET',
        url: 'not-a-url',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('SCRIPT', () => {
    it('accepts valid JavaScript script', () => {
      const res = validateStepConfig('SCRIPT', {
        language: 'javascript',
        code: 'console.log("hello");',
      });
      expect(res.success).toBe(true);
    });

    it('accepts valid Python script', () => {
      const res = validateStepConfig('SCRIPT', {
        language: 'python',
        code: 'print("hello")',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid language', () => {
      const res = validateStepConfig('SCRIPT', {
        language: 'ruby',
        code: 'puts "hello"',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('DELAY', () => {
    it('accepts valid duration', () => {
      const res = validateStepConfig('DELAY', {
        duration_ms: 5000,
      });
      expect(res.success).toBe(true);
    });

    it('rejects too large duration', () => {
      const res = validateStepConfig('DELAY', {
        duration_ms: 4_000_000, // max 1 hour (3_600_000)
      });
      expect(res.success).toBe(false);
    });

    it('rejects negative duration', () => {
      const res = validateStepConfig('DELAY', {
        duration_ms: -100,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('CONDITIONAL', () => {
    it('accepts valid conditional expression', () => {
      const res = validateStepConfig('CONDITIONAL', {
        expr: 'input.amount > 100',
      });
      expect(res.success).toBe(true);
    });

    it('rejects empty expression', () => {
      const res = validateStepConfig('CONDITIONAL', {
        expr: '',
      });
      expect(res.success).toBe(false);
    });
  });
});
