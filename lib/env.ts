import { z } from 'zod';

const UiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and must not be empty'),
  RUN_STORE_URL: z.string().min(1, 'RUN_STORE_URL is required and must not be empty'),
  APP_SHARED_SECRET: z.string().min(1, 'APP_SHARED_SECRET is required and must not be empty'),
});

export interface UiEnv {
  databaseUrl: string;
  runStoreUrl: string;
  appSharedSecret: string;
}

/**
 * Validate and load UI environment variables.
 * Single source of truth for the three required server-side secrets.
 * @param source - The environment source object (defaults to process.env).
 * @throws If DATABASE_URL, RUN_STORE_URL, or APP_SHARED_SECRET is missing or empty.
 * NOTE: Secret values are never logged.
 */
export function loadUiEnv(source: Record<string, string | undefined> = process.env): UiEnv {
  const result = UiEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variable(s): ${missing}`);
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
    runStoreUrl: result.data.RUN_STORE_URL,
    appSharedSecret: result.data.APP_SHARED_SECRET,
  };
}
