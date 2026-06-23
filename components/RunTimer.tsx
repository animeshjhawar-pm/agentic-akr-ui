'use client';

/**
 * RunTimer -- the "time taken" display for a run.
 *
 * Given a start origin and an optional end:
 *   - end provided  -> static total duration (end - start). This is the logged
 *     time taken for a finished run.
 *   - end omitted   -> a LIVE counter that ticks every second from start to now,
 *     so it grows the moment a run begins.
 *   - start null    -> renders a dash (nothing to measure yet).
 *
 * The ticking `now` is initialized to `start` (elapsed 0) so the server-rendered
 * and first client-rendered markup match (no hydration flicker); the effect then
 * advances it to the real wall clock and ticks once per second.
 */

import React, { useEffect, useState } from 'react';
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

export default function RunTimer({
  startMs,
  endMs = null,
  className,
  showIcon = false,
}: RunTimerProps) {
  const live = endMs == null && startMs != null;

  const [now, setNow] = useState<number>(startMs ?? 0);

  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live, startMs]);

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
