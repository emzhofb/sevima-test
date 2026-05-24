import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';
import { serialize } from './serialize.js';
import type { WorkflowDefinition } from '@flowforge/shared';

const cases: Array<{ name: string; def: WorkflowDefinition }> = [
  {
    name: 'single step',
    def: {
      name: 'one',
      timeout_sec: 60,
      steps: [{ id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false }],
    },
  },
  {
    name: 'linear chain',
    def: {
      name: 'linear',
      timeout_sec: 60,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'c', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 100 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'diamond',
    def: {
      name: 'diamond',
      timeout_sec: 60,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'c', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 'd', type: 'DELAY', depends_on: ['b', 'c'], config: { duration_ms: 100 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'with retry policy',
    def: {
      name: 'retry',
      timeout_sec: 60,
      steps: [{
        id: 'a',
        type: 'HTTP',
        depends_on: [],
        config: { method: 'GET', url: 'https://example.com' },
        retry: { max_attempts: 3, backoff_base_ms: 100, backoff_max_ms: 1000, jitter: true },
        continue_on_failure: false,
      }],
    },
  },
  {
    name: 'fan-out',
    def: {
      name: 'fanout',
      timeout_sec: 120,
      steps: [
        { id: 'start', type: 'DELAY', depends_on: [], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'out-1', type: 'DELAY', depends_on: ['start'], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'out-2', type: 'DELAY', depends_on: ['start'], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'out-3', type: 'DELAY', depends_on: ['start'], config: { duration_ms: 10 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'fan-in',
    def: {
      name: 'fanin',
      timeout_sec: 180,
      steps: [
        { id: 'in-1', type: 'DELAY', depends_on: [], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'in-2', type: 'DELAY', depends_on: [], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'in-3', type: 'DELAY', depends_on: [], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'merge', type: 'DELAY', depends_on: ['in-1', 'in-2', 'in-3'], config: { duration_ms: 10 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'mixed step types',
    def: {
      name: 'mixed',
      timeout_sec: 300,
      steps: [
        { id: 's1', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, continue_on_failure: false },
        { id: 's2', type: 'SCRIPT', depends_on: ['s1'], config: { language: 'javascript', code: 'x = 1' }, continue_on_failure: false },
        { id: 's3', type: 'HTTP', depends_on: ['s2'], config: { url: 'https://example.com', method: 'POST' }, continue_on_failure: true },
        { id: 's4', type: 'CONDITIONAL', depends_on: ['s3'], config: { expr: 'true' }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'timeout configuration',
    def: {
      name: 'timeout',
      timeout_sec: 3600,
      steps: [
        { id: 'step-with-timeout', type: 'DELAY', depends_on: [], config: { duration_ms: 100 }, timeout_sec: 10, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'continue on failure enabled',
    def: {
      name: 'continue-on-failure',
      timeout_sec: 120,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 10 }, continue_on_failure: true },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 10 }, continue_on_failure: false },
      ],
    },
  },
  {
    name: 'complex dependencies',
    def: {
      name: 'complex',
      timeout_sec: 500,
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'c', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'd', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 10 }, continue_on_failure: false },
        { id: 'e', type: 'DELAY', depends_on: ['c', 'd'], config: { duration_ms: 10 }, continue_on_failure: false },
      ],
    },
  },
];

describe('round-trip JSON', () => {
  for (const tc of cases) {
    it(tc.name, () => {
      const json = serialize(tc.def, 'json');
      const result = parse(json);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.definition).toEqual(tc.def);
      }
    });
  }
});

describe('round-trip YAML', () => {
  for (const tc of cases) {
    it(tc.name, () => {
      const yaml = serialize(tc.def, 'yaml');
      const result = parse(yaml);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.definition).toEqual(tc.def);
      }
    });
  }
});
