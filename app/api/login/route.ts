// app/api/login/route.ts
//
// POST /api/login  -- authenticate with shared secret
// DELETE /api/login -- logout (clear session cookie)
//
// Security design:
//   - Reads APP_SHARED_SECRET from env (never sent to browser).
//   - Derives a session token = sha256(APP_SHARED_SECRET) as lowercase hex.
//   - Comparison uses crypto.timingSafeEqual on equal-length buffers (Node crypto).
//     For unequal-length inputs: we compare against the sha256 of the provided
//     secret rather than the raw secret, so buffer lengths are always 32 bytes.
//     This avoids a length oracle while still rejecting wrong secrets.
//   - On success: sets akr_session cookie (httpOnly, secure, sameSite=lax, path=/).
//   - The raw APP_SHARED_SECRET is never written to any response, log, or cookie.

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { loadUiEnv } from '@/lib/env';

const COOKIE_NAME = 'akr_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Compute sha256 hex of a string (Node crypto, always 64 hex chars).
 */
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two strings by hashing both to equal-length
 * sha256 digests first, then using timingSafeEqual.
 *
 * We hash both sides so the buffer lengths are always equal (32 bytes)
 * regardless of input length. This eliminates the length oracle without
 * requiring padding.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(sha256Hex(a), 'hex');
  const bufB = Buffer.from(sha256Hex(b), 'hex');
  // Lengths are always 32 bytes (sha256 output); timingSafeEqual is safe.
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request): Promise<Response> {
  let secret: string | undefined;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    secret = typeof body.secret === 'string' ? body.secret : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = loadUiEnv();
  const expectedSecret = env.appSharedSecret;

  // Constant-time comparison via double sha256 -- prevents timing oracle.
  const match = constantTimeEqual(secret, expectedSecret);

  if (!match) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Derive the opaque session token (sha256 of the raw secret).
  // This is what gets stored in the browser cookie -- never the raw secret.
  const sessionToken = sha256Hex(expectedSecret);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE(): Promise<Response> {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  // Clear the cookie by setting max-age=0
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
