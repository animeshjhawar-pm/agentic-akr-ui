// lib/auth/safe-next-path.ts
//
// Pure helper: validate that a "next" redirect param is a same-origin path.
//
// Defense-in-depth against open-redirect attacks: the login page reads `?next=`
// from the URL and uses it as the post-login redirect destination. An attacker
// could craft a link like /login?next=//evil.com and trick a user into being
// redirected off-site after signing in.
//
// Acceptance rule (identical to the one-liner in the task spec):
//   Accept only values that start with '/' AND do NOT start with '//'.
//   Everything else falls back to '/'.

/**
 * Return a validated same-origin path for use as a post-login redirect target.
 *
 * @param next - The raw value of the `next` query parameter (may be null/undefined).
 * @returns A safe path string: the input if it passes validation, or '/' otherwise.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/';
}
