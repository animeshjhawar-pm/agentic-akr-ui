import { describe, it, expect } from 'vitest';
import { loadUiEnv } from './env';

describe('loadUiEnv', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadUiEnv({})).toThrow('DATABASE_URL');
  });

  it('throws when DATABASE_URL is empty string', () => {
    expect(() => loadUiEnv({ DATABASE_URL: '' })).toThrow('DATABASE_URL');
  });

  it('returns databaseUrl when DATABASE_URL is present', () => {
    const result = loadUiEnv({ DATABASE_URL: 'postgres://localhost/mydb', APP_SHARED_SECRET: 'testsecret' });
    expect(result.databaseUrl).toBe('postgres://localhost/mydb');
  });
});
