// __tests__/auth/env-secret.test.ts
//
// Unit tests: APP_SHARED_SECRET must be required by loadUiEnv.

import { describe, it, expect } from 'vitest';

import { loadUiEnv } from '@/lib/env';

describe('loadUiEnv - APP_SHARED_SECRET', () => {
  it('throws when APP_SHARED_SECRET is missing', () => {
    expect(() =>
      loadUiEnv({ DATABASE_URL: 'postgres://localhost/test' }),
    ).toThrow(/APP_SHARED_SECRET/);
  });

  it('throws when APP_SHARED_SECRET is empty string', () => {
    expect(() =>
      loadUiEnv({ DATABASE_URL: 'postgres://localhost/test', APP_SHARED_SECRET: '' }),
    ).toThrow(/APP_SHARED_SECRET/);
  });

  it('returns appSharedSecret when both vars are provided', () => {
    const env = loadUiEnv({
      DATABASE_URL: 'postgres://localhost/test',
      APP_SHARED_SECRET: 'supersecret',
    });
    expect(env.appSharedSecret).toBe('supersecret');
  });

  it('still throws when DATABASE_URL is missing', () => {
    expect(() =>
      loadUiEnv({ APP_SHARED_SECRET: 'supersecret' }),
    ).toThrow(/DATABASE_URL/);
  });
});
