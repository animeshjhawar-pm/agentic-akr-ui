// lib/auth/middleware-gate.ts
//
// Pure helper for the middleware auth gate decision.
// Extracted to be unit-testable without the Next.js Edge runtime.
//
// isAllowed(path, cookieValue, expectedToken) -> boolean
//   - whitelisted paths: /login, /api/login, /_next/*, files with extensions
//   - valid session: cookieValue === expectedToken (string equality)
//   - everything else: false

/**
 * Paths that bypass the auth gate entirely.
 *
 * Whitelist rules (checked in order):
 *   1. Exactly /login or starts with /login?
 *   2. Exactly /api/login (the login POST endpoint)
 *   3. Starts with /_next/
 *   4. Has a file extension (static assets: .svg, .ico, .png, .css, .js, etc.)
 */
export function isWhitelisted(path: string): boolean {
  // Strip query string for matching
  const bare = path.split('?')[0];

  if (bare === '/login' || bare.startsWith('/login/')) return true;
  if (bare === '/api/login') return true;
  if (bare.startsWith('/_next/')) return true;

  // Static asset: path has a file extension
  const lastSegment = bare.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return true;

  return false;
}

/**
 * Determine whether a request should be allowed through.
 *
 * @param path - The request pathname (with or without query string).
 * @param cookieValue - The value of the akr_session cookie, or undefined.
 * @param expectedToken - The precomputed session token (sha256 hex of APP_SHARED_SECRET).
 * @returns true if the request should be allowed; false if it should be blocked.
 */
export function isAllowed(
  path: string,
  cookieValue: string | undefined,
  expectedToken: string,
): boolean {
  if (isWhitelisted(path)) return true;
  if (!cookieValue) return false;
  return cookieValue === expectedToken;
}
