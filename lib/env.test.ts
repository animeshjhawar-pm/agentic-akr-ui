import { describe, it, expect } from 'vitest';
import { loadUiEnv } from './env';

const VALID = {
  DATABASE_URL: 'postgres://localhost/mydb',
  RUN_STORE_URL: 'postgres://localhost/run_store',
  APP_SHARED_SECRET: 'testsecret',
};

describe('loadUiEnv', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadUiEnv({})).toThrow('DATABASE_URL');
  });

  it('throws when DATABASE_URL is empty string', () => {
    expect(() => loadUiEnv({ DATABASE_URL: '' })).toThrow('DATABASE_URL');
  });

  it('returns databaseUrl when all vars are present', () => {
    const result = loadUiEnv(VALID);
    expect(result.databaseUrl).toBe('postgres://localhost/mydb');
  });
});
