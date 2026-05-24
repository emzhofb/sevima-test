import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

export type CreateLoggerOptions = {
  env?: NodeJS.ProcessEnv;
  destination?: DestinationStream;
};

export function createLogger(name: string, options: CreateLoggerOptions = {}): Logger {
  const env = options.env ?? process.env;
  const loggerOptions = createLoggerOptions(name, env);

  if (options.destination) {
    return pino(loggerOptions, options.destination);
  }

  return pino(loggerOptions);
}

export function createLoggerOptions(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): LoggerOptions {
  const isProduction = env.NODE_ENV === 'production';

  const options: LoggerOptions = {
    name,
    level: env.LOG_LEVEL ?? 'info',
  };

  if (!isProduction) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
      },
    };
  }

  return options;
}
