// __tests__/auth/safe-next-path.test.ts
//
// Unit tests for the safeNextPath() helper that validates the "next" redirect
// param on the login page, guarding against open-redirect attacks.
//
// Rules:
//   - Accept only values that start with '/' AND do NOT start with '//'
//   - Anything else (protocol-relative, absolute URL, empty, null) falls back to '/'

import { describe, it, expect } from 'vitest';
import { safeNextPath } from '@/lib/auth/safe-next-path';

describe('safeNextPath -- accepts same-origin paths', () => {
  it('passes through a simple same-origin path', () => {
    expect(safeNextPath('/runs')).toBe('/runs');
  });

  it('passes through a nested path', () => {
    expect(safeNextPath('/runs/123/details')).toBe('/runs/123/details');
  });

  it('passes through the root path', () => {
    expect(safeNextPath('/')).toBe('/');
  });

  it('passes through a path with a query string', () => {
    expect(safeNextPath('/runs?page=2')).toBe('/runs?page=2');
  });
});

describe('safeNextPath -- rejects dangerous values', () => {
  it('rejects a protocol-relative URL starting with //', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
  });

  it('rejects a protocol-relative URL with a path after the host', () => {
    expect(safeNextPath('//evil.com/steal')).toBe('/');
  });

  it('rejects an absolute https URL', () => {
    expect(safeNextPath('https://evil.com')).toBe('/');
  });

  it('rejects an absolute http URL', () => {
    expect(safeNextPath('http://evil.com/path')).toBe('/');
  });

  it('rejects an empty string', () => {
    expect(safeNextPath('')).toBe('/');
  });

  it('rejects null (treated as missing)', () => {
    expect(safeNextPath(null)).toBe('/');
  });

  it('rejects undefined', () => {
    expect(safeNextPath(undefined)).toBe('/');
  });

  it('rejects a bare hostname with no leading slash', () => {
    expect(safeNextPath('evil.com')).toBe('/');
  });
});
