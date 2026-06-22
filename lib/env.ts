import { z } from 'zod';

const UiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and must not be empty'),
  APP_SHARED_SECRET: z.string().min(1, 'APP_SHARED_SECRET is required and must not be empty'),
});

export interface UiEnv {
  databaseUrl: string;
  appSharedSecret: string;
}

/**
 * Validate and load UI environment variables.
 * @param source - The environment source object (defaults to process.env).
 * @throws If DATABASE_URL or APP_SHARED_SECRET is missing or empty.
 * NOTE: The value of APP_SHARED_SECRET is never logged.
 */
export function loadUiEnv(source: Record<string, string | undefined> = process.env): UiEnv {
  const result = UiEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variable(s): ${missing}`);
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
    appSharedSecret: result.data.APP_SHARED_SECRET,
  };
}
