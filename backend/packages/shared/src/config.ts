import { z } from 'zod';

export const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    PORT: z.coerce.number().int().positive().default(3000),
    AI_ENABLED: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          if (val.toLowerCase() === 'true') return true;
          if (val.toLowerCase() === 'false') return false;
        }
        return val;
      }, z.boolean())
      .default(false),
    OPENAI_API_KEY: z.string().optional(),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigSource = Record<string, string | number | undefined>;

export class ConfigValidationError extends Error {
  readonly issues: z.typeToFlattenedError<ConfigSource>['fieldErrors'];

  constructor(issues: z.typeToFlattenedError<ConfigSource>['fieldErrors']) {
    super(`Environment validation failed: ${formatConfigIssues(issues)}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export function loadConfig(env: ConfigSource = process.env): Config {
  const filteredEnv: ConfigSource = {};
  const allowedKeys = Object.keys(ConfigSchema.shape);
  for (const key of allowedKeys) {
    if (key in env) {
      filteredEnv[key] = env[key];
    }
  }
  const result = ConfigSchema.safeParse(filteredEnv);

  if (!result.success) {
    throw new ConfigValidationError(result.error.flatten().fieldErrors);
  }

  return result.data;
}

function formatConfigIssues(issues: z.typeToFlattenedError<ConfigSource>['fieldErrors']): string {
  return Object.entries(issues)
    .map(([field, messages]) => `${field}: ${messages?.join(', ') ?? 'invalid'}`)
    .join('; ');
}
