'use client';

/**
 * Tooltip
 *
 * Lightweight accessible tooltip.
 * - Shows on hover + keyboard focus of the trigger button.
 * - Uses aria-describedby to associate the description with the trigger.
 * - Respects prefers-reduced-motion (no transition when motion is reduced).
 * - Lucide Info icon is the default affordance.
 */

import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  /** The description text shown inside the tooltip. */
  description: string;
  /** Optional additional className for the wrapper span. */
  className?: string;
}

export default function Tooltip({ description, className }: TooltipProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <span className={['relative inline-flex items-center', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        aria-label="More information"
        aria-describedby={id}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className={[
          'inline-flex items-center justify-center rounded',
          'text-on-surface-muted hover:text-on-surface',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          'cursor-default',
        ].join(' ')}
      >
        <Info size={12} aria-hidden="true" />
      </button>

      {/* Description element -- always in the DOM so aria-describedby resolves */}
      <span
        id={id}
        role="tooltip"
        className={[
          'absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2',
          'rounded-md border border-border bg-surface px-2.5 py-2 text-xs text-on-surface shadow-md',
          'pointer-events-none select-none',
          // Motion-aware visibility transition
          'motion-safe:transition-opacity motion-safe:duration-150',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {description}
      </span>
    </span>
  );
}
