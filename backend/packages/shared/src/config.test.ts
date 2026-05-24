import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { ConfigValidationError, loadConfig } from './config.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://flowforge:flowforge@localhost:5432/flowforge',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  PORT: '3000',
};

describe('loadConfig', () => {
  const nodeEnvArb = fc.constantFrom('development', 'production', 'test') as fc.Arbitrary<
    'development' | 'production' | 'test'
  >;

  it('loads and coerces a valid environment', () => {
    expect(loadConfig(baseEnv)).toEqual({
      NODE_ENV: 'test',
      DATABASE_URL: baseEnv.DATABASE_URL,
      REDIS_URL: baseEnv.REDIS_URL,
      JWT_SECRET: baseEnv.JWT_SECRET,
      PORT: 3000,
    });
  });

  it('uses documented defaults for optional environment variables', () => {
    const { NODE_ENV: _nodeEnv, PORT: _port, ...env } = baseEnv;

    expect(loadConfig(env)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('throws an informative error when required environment variables are missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigValidationError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({})).toThrow(/REDIS_URL/);
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
  });

  it('rejects JWT_SECRET values shorter than 32 characters', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        JWT_SECRET: 'short',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('accepts valid generated config values', () => {
    fc.assert(
      fc.property(
        nodeEnvArb,
        fc.webUrl(),
        fc.webUrl(),
        fc.string({ minLength: 32 }),
        fc.integer({ min: 1, max: 65535 }),
        (NODE_ENV, DATABASE_URL, REDIS_URL, JWT_SECRET, PORT) => {
          expect(() =>
            loadConfig({
              NODE_ENV,
              DATABASE_URL,
              REDIS_URL,
              JWT_SECRET,
              PORT: String(PORT),
            }),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects generated JWT_SECRET values below the minimum length', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 31 }), (JWT_SECRET: string) => {
        expect(() =>
          loadConfig({
            ...baseEnv,
            JWT_SECRET,
          }),
        ).toThrow(ConfigValidationError);
      }),
      { numRuns: 100 },
    );
  });
});
