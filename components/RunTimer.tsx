'use client';

/**
 * RunTimer -- the "time taken" display for a run.
 *
 * Given a start origin and an optional end:
 *   - end provided  -> static total duration (end - start). The logged time taken.
 *   - end omitted    -> a LIVE counter: now - start, refreshed every second while
 *     the run is in flight.
 *   - start null     -> a dash (nothing to measure yet).
 *
 * The live clock is read via useSyncExternalStore -- its getSnapshot is the
 * sanctioned place to read mutable external state (the wall clock), so there is
 * no impure-render or setState-in-effect lint violation. The server snapshot is
 * a deterministic 0; RunTimer is also only mounted after a client interaction
 * (selecting/triggering a run), so it never renders during SSR.
 */

import React, { useCallback, useSyncExternalStore } from 'react';
import { Clock } from 'lucide-react';
import { formatDuration } from '@/lib/formatDuration';

interface RunTimerProps {
  /** Epoch ms the run started (or was queued/triggered). Null -> nothing to show. */
  startMs: number | null;
  /** Epoch ms the run finished. Null/omitted -> live ticking. */
  endMs?: number | null;
  className?: string;
  /** Show a small clock icon before the value. */
  showIcon?: boolean;
}

/** Current epoch ms, re-rendering once per second while `active`. */
function useNow(active: boolean): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) return () => {};
      const id = setInterval(onChange, 1000);
      return () => clearInterval(id);
    },
    [active],
  );
  return useSyncExternalStore(
    subscribe,
    () => Date.now(),
    () => 0,
  );
}

export default function RunTimer({
  startMs,
  endMs = null,
  className,
  showIcon = false,
}: RunTimerProps) {
  const live = endMs == null && startMs != null;
  const now = useNow(live);

  if (startMs == null) {
    return (
      <span className={className} aria-label="time taken unavailable">
        {showIcon && <Clock size={12} aria-hidden="true" className="inline mr-1 -mt-0.5" />}
        --
      </span>
    );
  }

  const elapsed = (endMs ?? now) - startMs;

  return (
    <span
      className={className}
      aria-label={`time taken ${formatDuration(elapsed)}`}
      title="Time taken"
    >
      {showIcon && <Clock size={12} aria-hidden="true" className="inline mr-1 -mt-0.5" />}
      {formatDuration(elapsed)}
    </span>
  );
}
