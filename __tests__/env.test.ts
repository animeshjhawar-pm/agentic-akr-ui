// __tests__/env.test.ts
//
// Unit tests for loadUiEnv -- all three required server-side secrets must be
// present and non-empty; missing any one throws with the var name in the message.

import { describe, it, expect } from 'vitest';

import { loadUiEnv } from '@/lib/env';

const VALID = {
  DATABASE_URL: 'postgres://localhost/test',
  RUN_STORE_URL: 'postgres://localhost/run_store',
  APP_SHARED_SECRET: 'supersecret',
};

describe('loadUiEnv', () => {
  it('throws when RUN_STORE_URL is missing', () => {
    const { RUN_STORE_URL: _omit, ...rest } = VALID;
    expect(() => loadUiEnv(rest)).toThrow(/RUN_STORE_URL/);
  });

  it('throws when RUN_STORE_URL is empty string', () => {
    expect(() => loadUiEnv({ ...VALID, RUN_STORE_URL: '' })).toThrow(/RUN_STORE_URL/);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = VALID;
    expect(() => loadUiEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when APP_SHARED_SECRET is missing', () => {
    const { APP_SHARED_SECRET: _omit, ...rest } = VALID;
    expect(() => loadUiEnv(rest)).toThrow(/APP_SHARED_SECRET/);
  });

  it('returns all three values when all vars are present', () => {
    const env = loadUiEnv(VALID);
    expect(env.databaseUrl).toBe(VALID.DATABASE_URL);
    expect(env.runStoreUrl).toBe(VALID.RUN_STORE_URL);
    expect(env.appSharedSecret).toBe(VALID.APP_SHARED_SECRET);
  });
});
