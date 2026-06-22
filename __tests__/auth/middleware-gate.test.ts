// __tests__/auth/middleware-gate.test.ts
//
// Unit tests for the pure isAllowed() helper extracted from middleware.ts.
// Tests the allow/deny logic without needing the Next runtime.

import { describe, it, expect } from 'vitest';
import { isAllowed } from '@/lib/auth/middleware-gate';

const EXPECTED_TOKEN = 'abc123expectedtoken';

describe('isAllowed -- whitelisted paths', () => {
  it('allows /login without a cookie', () => {
    expect(isAllowed('/login', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /login with query string', () => {
    expect(isAllowed('/login', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /_next/static/chunk.js without a cookie', () => {
    expect(isAllowed('/_next/static/chunk.js', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /favicon.ico without a cookie', () => {
    expect(isAllowed('/favicon.ico', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows files with any extension (static assets)', () => {
    expect(isAllowed('/gush_logo.svg', undefined, EXPECTED_TOKEN)).toBe(true);
    expect(isAllowed('/some/file.png', undefined, EXPECTED_TOKEN)).toBe(true);
    expect(isAllowed('/styles/main.css', undefined, EXPECTED_TOKEN)).toBe(true);
  });
});

describe('isAllowed -- valid session cookie', () => {
  it('allows a page route when cookie equals expected token', () => {
    expect(isAllowed('/', EXPECTED_TOKEN, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows an API route when cookie equals expected token', () => {
    expect(isAllowed('/api/clients', EXPECTED_TOKEN, EXPECTED_TOKEN)).toBe(true);
  });
});

describe('isAllowed -- missing or invalid cookie', () => {
  it('denies a page route when no cookie provided', () => {
    expect(isAllowed('/', undefined, EXPECTED_TOKEN)).toBe(false);
  });

  it('denies a page route when cookie is wrong', () => {
    expect(isAllowed('/', 'wrongtoken', EXPECTED_TOKEN)).toBe(false);
  });

  it('denies an API route when no cookie provided', () => {
    expect(isAllowed('/api/clients', undefined, EXPECTED_TOKEN)).toBe(false);
  });

  it('denies an API route when cookie is wrong', () => {
    expect(isAllowed('/api/runs', 'badtoken', EXPECTED_TOKEN)).toBe(false);
  });

  it('denies the root path with empty string cookie', () => {
    expect(isAllowed('/', '', EXPECTED_TOKEN)).toBe(false);
  });
});

describe('isAllowed -- /api/login is whitelisted', () => {
  it('allows POST /api/login without a cookie', () => {
    expect(isAllowed('/api/login', undefined, EXPECTED_TOKEN)).toBe(true);
  });
});
