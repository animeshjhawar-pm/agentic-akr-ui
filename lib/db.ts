import pg from 'pg';
import { loadUiEnv } from './env';

// RDS requires SSL; rejectUnauthorized: false allows self-signed certs commonly
// used in AWS RDS without a full CA cert bundle in the container.
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const env = loadUiEnv();
    pool = new pg.Pool({
      connectionString: env.databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Pure query helper -- pass an explicit client (for tests: a fake { query })
 * or omit to use the singleton pool.
 */
export async function runQuery(
  client: QueryClient,
  text: string,
  params?: unknown[],
): Promise<{ rows: Record<string, unknown>[] }> {
  return client.query(text, params);
}

/**
 * Convenience wrapper that uses the singleton pool.
 */
export async function query(
  text: string,
  params?: unknown[],
): Promise<{ rows: Record<string, unknown>[] }> {
  return runQuery(getPool(), text, params);
}
