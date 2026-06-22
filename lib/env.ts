import { z } from 'zod';

const UiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and must not be empty'),
});

export interface UiEnv {
  databaseUrl: string;
}

/**
 * Validate and load UI environment variables.
 * @param source - The environment source object (defaults to process.env).
 * @throws If DATABASE_URL is missing or empty.
 */
export function loadUiEnv(source: Record<string, string | undefined> = process.env): UiEnv {
  const result = UiEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variable(s): ${missing}`);
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
  };
}
