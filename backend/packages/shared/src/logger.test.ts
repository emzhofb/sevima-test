import { Writable } from 'node:stream';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createLogger, createLoggerOptions } from './logger.js';

function captureLogs() {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  return {
    destination,
    readLines: () => chunks.join('').split('\n').filter(Boolean),
  };
}

describe('createLogger', () => {
  it('writes JSON logs in production with the service name', () => {
    const output = captureLogs();
    const logger = createLogger('api', {
      env: { NODE_ENV: 'production' },
      destination: output.destination,
    });

    logger.info({ requestId: 'req-1' }, 'request completed');

    const [line] = output.readLines();
    expect(line).toBeDefined();

    const entry = JSON.parse(line as string) as Record<string, unknown>;
    expect(entry).toMatchObject({
      name: 'api',
      level: 30,
      requestId: 'req-1',
      msg: 'request completed',
    });
  });

  it('uses pino-pretty transport outside production', () => {
    expect(createLoggerOptions('worker', { NODE_ENV: 'development' })).toMatchObject({
      name: 'worker',
      transport: {
        target: 'pino-pretty',
      },
    });
  });

  it('does not configure pretty transport in production', () => {
    const options = createLoggerOptions('worker', { NODE_ENV: 'production' });

    expect(options.name).toBe('worker');
    expect(options).not.toHaveProperty('transport');
  });

  it('uses LOG_LEVEL when configured', () => {
    expect(createLoggerOptions('scheduler', { LOG_LEVEL: 'debug' })).toMatchObject({
      level: 'debug',
    });
  });

  it('keeps generated service names in every JSON log entry', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 64 })
          .filter((value: string) => !value.includes('\n') && !value.includes('\r')),
        (name: string) => {
          const output = captureLogs();
          const logger = createLogger(name, {
            env: { NODE_ENV: 'production' },
            destination: output.destination,
          });

          logger.info('hello');

          const [line] = output.readLines();
          const entry = JSON.parse(line as string) as Record<string, unknown>;
          expect(entry.name).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });
});
