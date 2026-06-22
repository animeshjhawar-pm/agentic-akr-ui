/**
 * lib/store/pg.ts
 *
 * Lazy singleton Pool for the Supabase run-store, plus a thin query wrapper
 * that accepts any { query } shaped client -- making tests trivial (inject a
 * fake, never touch a real DB).
 *
 * Connection string is read exclusively from RUN_STORE_URL. No secrets are
 * logged or hardcoded.
 */

import pg from 'pg';

let _pool: pg.Pool | null = null;

/**
 * Returns the singleton Pool, creating it on first call.
 * Throws a clear error when RUN_STORE_URL is not set so the caller gets an
 * actionable message instead of a cryptic connection failure.
 */
export function getRunStorePool(): pg.Pool {
  if (!_pool) {
    const url = process.env.RUN_STORE_URL;
    if (!url) {
      throw new Error(
        'RUN_STORE_URL env var is not set -- cannot connect to the run store.',
      );
    }
    _pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

/** Shape accepted by runQuery -- real pg.Pool and test fakes both satisfy it. */
export interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Thin wrapper so all callers go through a single point and tests can inject
 * a fake pool without any monkey-patching.
 */
export async function runQuery(
  pool: QueryClient,
  text: string,
  params?: unknown[],
): Promise<{ rows: Record<string, unknown>[] }> {
  return pool.query(text, params);
}
