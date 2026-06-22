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
 * Known static-file extensions that bypass the auth gate.
 * Checked against the END of the path (after stripping query string).
 * Deliberately narrow: only real asset types, NOT arbitrary dots in path segments
 * (e.g. /api/runs.json or /api/v1.0/runs must still require auth).
 */
const STATIC_EXTENSIONS = new Set([
  '.svg', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.css', '.js', '.map', '.woff', '.woff2', '.ttf', '.json',
]);

/**
 * Paths that bypass the auth gate entirely.
 *
 * Whitelist rules (checked in order):
 *   1. Exactly /login or starts with /login/
 *   2. Exactly /api/login (the login POST endpoint)
 *   3. Starts with /_next/
 *   4. Ends with a known static-file extension (from STATIC_EXTENSIONS above)
 *      -- checked against the full bare path, not just the last segment,
 *      so /api/runs.json is NOT matched (it is an API route, not a static file).
 *      A real static file like /favicon.ico or /logo.svg WILL match.
 */
export function isWhitelisted(path: string): boolean {
  // Strip query string for matching
  const bare = path.split('?')[0];

  if (bare === '/login' || bare.startsWith('/login/')) return true;
  if (bare === '/api/login') return true;
  if (bare.startsWith('/_next/')) return true;

  // Static asset: bare path ends with a known extension (case-insensitive).
  // Explicitly exclude /api/* paths: API routes that happen to end with a known
  // extension (e.g. /api/runs.json) must still require auth.
  if (!bare.startsWith('/api/')) {
    const lower = bare.toLowerCase();
    for (const ext of STATIC_EXTENSIONS) {
      if (lower.endsWith(ext)) return true;
    }
  }

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
