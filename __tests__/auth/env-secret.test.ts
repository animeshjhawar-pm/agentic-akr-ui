// __tests__/auth/env-secret.test.ts
//
// Unit tests: APP_SHARED_SECRET must be required by loadUiEnv.

import { describe, it, expect } from 'vitest';

import { loadUiEnv } from '@/lib/env';

const BASE = {
  DATABASE_URL: 'postgres://localhost/test',
  RUN_STORE_URL: 'postgres://localhost/run_store',
  APP_SHARED_SECRET: 'supersecret',
};

describe('loadUiEnv - APP_SHARED_SECRET', () => {
  it('throws when APP_SHARED_SECRET is missing', () => {
    const { APP_SHARED_SECRET: _omit, ...rest } = BASE;
    expect(() => loadUiEnv(rest)).toThrow(/APP_SHARED_SECRET/);
  });

  it('throws when APP_SHARED_SECRET is empty string', () => {
    expect(() =>
      loadUiEnv({ ...BASE, APP_SHARED_SECRET: '' }),
    ).toThrow(/APP_SHARED_SECRET/);
  });

  it('returns appSharedSecret when all vars are provided', () => {
    const env = loadUiEnv(BASE);
    expect(env.appSharedSecret).toBe('supersecret');
  });

  it('still throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = BASE;
    expect(() => loadUiEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
