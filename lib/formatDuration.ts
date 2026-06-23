// lib/formatDuration.ts
//
// Pure helpers for the run "time taken" display. No React, no I/O.

/**
 * Format a millisecond duration as a compact human string.
 *   < 1m  -> "45s"
 *   < 1h  -> "1m 5s"
 *   >= 1h -> "1h 1m 1s"
 * Negative / non-finite inputs clamp to 0s.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Parse an ISO timestamp (or null) to epoch ms, returning null for missing or
 * unparseable values. Safe to feed straight into a timer origin.
 */
export function isoToMs(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}
