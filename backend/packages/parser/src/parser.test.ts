import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

describe('parse', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify({
      name: 'test',
      timeout_sec: 60,
      steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } }],
    });
    const result = parse(json);
    expect(result.ok).toBe(true);
  });

  it('rejects input > 5 MB', () => {
    const huge = '{' + '"a":"' + 'a'.repeat(6 * 1024 * 1024) + '"}';
    const result = parse(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.issue).toBe('input_too_large');
    }
  });

  it('rejects > 1000 steps', () => {
    const def = {
      name: 'test',
      timeout_sec: 60,
      steps: Array.from({ length: 1001 }, (_, i) => ({
        id: `s${i}`, type: 'DELAY', depends_on: [], config: { duration_ms: 100 },
      })),
    };
    const result = parse(JSON.stringify(def));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.issue).toBe('input_too_large');
    }
  });

  it('parses valid YAML', () => {
    const yaml = `
name: test-yaml
timeout_sec: 120
steps:
  - id: step-1
    type: DELAY
    depends_on: []
    config:
      duration_ms: 500
    continue_on_failure: true
`;
    const result = parse(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.name).toBe('test-yaml');
      expect(result.definition.steps[0]!.id).toBe('step-1');
      expect(result.definition.steps[0]!.continue_on_failure).toBe(true);
    }
  });
});
