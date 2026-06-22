// middleware.ts
//
// Next.js middleware -- shared-secret auth gate.
//
// Approach:
//   - The session token stored in the akr_session cookie is sha256(APP_SHARED_SECRET)
//     as a 64-char lowercase hex string. It is derived server-side in the login route
//     (app/api/login/route.ts) and set as an httpOnly cookie. The raw secret never
//     leaves the server.
//   - In middleware we need to compare the cookie to the expected token. The middleware
//     runs on the Edge runtime where Node's crypto module is unavailable. We use the
//     Web Crypto API (crypto.subtle) to recompute sha256(APP_SHARED_SECRET) and then
//     do a simple string comparison.
//   - The comparison in middleware is a cookie check (already a sha256 hash), NOT the
//     secret comparison. The secret comparison (timingSafeEqual) lives only in the
//     login route which runs in the Node.js runtime. This design means the raw secret
//     is never exposed in Edge code.
//
// Route behavior:
//   - Whitelisted paths (/login, /api/login, /_next/*, static assets): pass through.
//   - Valid akr_session cookie: pass through.
//   - No/invalid cookie + page request: redirect to /login?next=<path>.
//   - No/invalid cookie + /api/* request: return 401 JSON.

import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/auth/middleware-gate';

const COOKIE_NAME = 'akr_session';

/**
 * Compute sha256 of a UTF-8 string using the Web Crypto API.
 * Returns lowercase hex (64 chars). Safe in Edge runtime.
 */
async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  const sharedSecret = process.env.APP_SHARED_SECRET;
  if (!sharedSecret) {
    // Misconfigured server: block all requests until the secret is set.
    return new NextResponse(
      JSON.stringify({ error: 'Server misconfigured: APP_SHARED_SECRET not set' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const expectedToken = await sha256Hex(sharedSecret);
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;

  if (isAllowed(pathname, cookieValue, expectedToken)) {
    return NextResponse.next();
  }

  // Blocked -- differentiate page vs API requests
  if (pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Page navigation -- redirect to /login with next param.
  // We use req.nextUrl.pathname (the server-parsed pathname), which is always a
  // same-origin path -- never a full URL -- so this is already safe without extra
  // validation here. The login page additionally validates the next param via
  // safeNextPath() before using it as the post-login redirect destination.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all routes; path matching/whitelisting is done in the middleware itself.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
