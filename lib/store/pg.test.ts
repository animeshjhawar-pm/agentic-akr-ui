/**
 * lib/store/pg.test.ts
 *
 * Tests for getRunStorePool (env-guard) and runQuery (thin wrapper).
 * No real DB connection is made.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runQuery } from './pg';

describe('runQuery', () => {
  it('delegates to pool.query with text and params', async () => {
    const fakeRows = [{ id: 'abc' }];
    const fakePool = {
      query: vi.fn().mockResolvedValue({ rows: fakeRows }),
    };
    const result = await runQuery(fakePool, 'SELECT $1', ['abc']);
    expect(fakePool.query).toHaveBeenCalledWith('SELECT $1', ['abc']);
    expect(result.rows).toEqual(fakeRows);
  });

  it('passes undefined params through when omitted', async () => {
    const fakePool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    await runQuery(fakePool, 'SELECT 1');
    expect(fakePool.query).toHaveBeenCalledWith('SELECT 1', undefined);
  });
});

describe('getRunStorePool -- env guard', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.RUN_STORE_URL;
    // Reset module registry so singleton is cleared between tests.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RUN_STORE_URL;
    } else {
      process.env.RUN_STORE_URL = originalEnv;
    }
  });

  it('throws a clear error when RUN_STORE_URL is not set', async () => {
    delete process.env.RUN_STORE_URL;
    // Re-import after resetting modules so the singleton is fresh.
    const { getRunStorePool } = await import('./pg');
    expect(() => getRunStorePool()).toThrow('RUN_STORE_URL');
  });

  it('does not throw when RUN_STORE_URL is set', async () => {
    process.env.RUN_STORE_URL = 'postgresql://fake:fake@localhost:5432/fake';
    const { getRunStorePool } = await import('./pg');
    // We only check it does not throw; we do not attempt a real connection.
    expect(() => getRunStorePool()).not.toThrow();
  });
});
