// __tests__/auth/login-route.test.ts
//
// Unit tests for POST /api/login route.
// Tests: correct secret -> 200 + httpOnly cookie; wrong secret -> 401 no cookie.
// Tests constant-time path: equal-length and unequal-length both handled without throwing.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env so APP_SHARED_SECRET is always available in tests.
vi.mock('@/lib/env', () => ({
  loadUiEnv: vi.fn(() => ({
    databaseUrl: 'postgres://localhost/test',
    appSharedSecret: 'correct-test-secret',
  })),
}));

import { POST, DELETE } from '@/app/api/login/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and sets httpOnly akr_session cookie when secret is correct', async () => {
    const req = makeRequest({ secret: 'correct-test-secret' });
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Must set a cookie
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('akr_session=');
    expect(setCookie).toContain('HttpOnly');
    // Should not contain the raw secret in the cookie value
    expect(setCookie).not.toContain('correct-test-secret');
  });

  it('returns 401 and does not set a cookie when secret is wrong', async () => {
    const req = makeRequest({ secret: 'wrong-secret' });
    const res = await POST(req);

    expect(res.status).toBe(401);

    const setCookie = res.headers.get('set-cookie');
    // Either no set-cookie header, or it explicitly clears the cookie (max-age=0)
    if (setCookie) {
      // If a cookie is set on failure, it must be clearing/expiring it
      expect(setCookie).toMatch(/max-age=0|expires=.*1970/i);
    }
  });

  it('returns 401 when secret is an empty string (unequal-length constant-time path)', async () => {
    const req = makeRequest({ secret: '' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when body has no secret field', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when secret is longer than expected (unequal-length constant-time path)', async () => {
    const req = makeRequest({ secret: 'correct-test-secret-extra-padding-to-be-longer' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('cookie value is a sha256 hex string (64 chars) when correct', async () => {
    const req = makeRequest({ secret: 'correct-test-secret' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie') ?? '';
    // Extract the value from "akr_session=<value>;"
    const match = setCookie.match(/akr_session=([^;]+)/);
    expect(match).toBeTruthy();
    const cookieVal = match![1];
    // sha256 hex is exactly 64 lowercase hex chars
    expect(cookieVal).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not throw when invoked multiple times (constant-time path is stable)', async () => {
    for (const secret of ['correct-test-secret', '', 'short', 'correct-test-secret-but-longer']) {
      const req = makeRequest({ secret });
      await expect(POST(req)).resolves.not.toThrow();
    }
  });
});

describe('DELETE /api/login (logout)', () => {
  it('returns 200 and clears the akr_session cookie', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    // Cookie should be expired/cleared
    expect(setCookie).toMatch(/akr_session=;|max-age=0/i);
  });
});
