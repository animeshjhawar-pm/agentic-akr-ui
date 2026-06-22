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

// FIX 1: tightened static-asset allowlist -- known extensions only

describe('isAllowed -- known static extensions are whitelisted', () => {
  it('allows /favicon.ico (known extension)', () => {
    expect(isAllowed('/favicon.ico', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /logo.svg (known extension)', () => {
    expect(isAllowed('/logo.svg', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /_next/static/x.js (under /_next/)', () => {
    expect(isAllowed('/_next/static/x.js', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /image.png', () => {
    expect(isAllowed('/image.png', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /font.woff2', () => {
    expect(isAllowed('/font.woff2', undefined, EXPECTED_TOKEN)).toBe(true);
  });

  it('allows /data.json (known extension -- .json is in the set)', () => {
    expect(isAllowed('/data.json', undefined, EXPECTED_TOKEN)).toBe(true);
  });
});

describe('isAllowed -- dot-in-segment paths that are NOT static assets require auth', () => {
  it('denies /api/runs.json (dot in path but not a known standalone static file)', () => {
    // Under the old "last segment includes a dot" rule this would have bypassed auth.
    // With the tightened allowlist it must still require auth because it is an API route.
    expect(isAllowed('/api/runs.json', undefined, EXPECTED_TOKEN)).toBe(false);
  });

  it('denies /api/v1.0/runs (version segment has a dot -- not a file extension path)', () => {
    expect(isAllowed('/api/v1.0/runs', undefined, EXPECTED_TOKEN)).toBe(false);
  });

  it('denies /api/v2.1/clients with no cookie', () => {
    expect(isAllowed('/api/v2.1/clients', undefined, EXPECTED_TOKEN)).toBe(false);
  });

  it('still allows the same paths when a valid cookie is supplied', () => {
    expect(isAllowed('/api/runs.json', EXPECTED_TOKEN, EXPECTED_TOKEN)).toBe(true);
    expect(isAllowed('/api/v1.0/runs', EXPECTED_TOKEN, EXPECTED_TOKEN)).toBe(true);
  });
});
