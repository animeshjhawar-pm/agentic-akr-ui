'use client';

/**
 * EventLog
 *
 * Chronological list of RunEvents (capped to last 500 for performance).
 * Each row is expandable: collapsed shows timestamp + stage badge + detail string.
 * Expanded shows structured fields per event type.
 * Auto-scrolls to newest (bottom). Filtered by selectedStage when set.
 *
 * NOTE: Virtualization was dropped in Phase-2 Task 11 because variable-height
 * expanded rows are incompatible with fixed-size virtual items in @tanstack/react-virtual
 * without a ResizeObserver-backed measureElement pass. The list is capped to
 * MAX_VISIBLE events to bound DOM size.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { RunEvent } from '@/lib/events';

const MAX_VISIBLE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const STAGE_BADGE_CLASSES: Record<string, string> = {
  planner: 'bg-primary text-primary-fg',
  'seed-gen': 'bg-warning-surface text-warning',
  'angle-derivation': 'bg-warning-surface text-warning',
  'broad-match': 'bg-surface-muted text-on-surface',
  lane: 'bg-primary/20 text-primary',
  'name-expansion': 'bg-warning-surface text-warning',
  'mine-serp': 'bg-surface-muted text-on-surface',
  geo: 'bg-primary/10 text-primary',
  'pre-gate': 'bg-warning-surface text-warning',
  grade: 'bg-success-surface text-success',
  cluster: 'bg-surface-muted text-on-surface',
  score: 'bg-surface-muted text-on-surface',
  select: 'bg-success-surface text-success',
  run: 'bg-primary text-primary-fg',
};

export function stageBadgeClass(stage: string): string {
  return STAGE_BADGE_CLASSES[stage] ?? 'bg-surface-muted text-on-surface';
}

function eventSummary(evt: RunEvent): string {
  if ('detail' in evt && typeof (evt as { detail?: string }).detail === 'string') {
    return (evt as { detail: string }).detail;
  }
  switch (evt.stage) {
    case 'planner':
      return `step ${evt.step}: ${evt.rationale}`;
    case 'seed-gen':
    case 'angle-derivation':
      return evt.type === 'done' && evt.count != null
        ? `${evt.type} (count: ${evt.count})`
        : evt.type;
    case 'broad-match':
      if (evt.type === 'expand') return `expand "${evt.seed}" -> ${evt.produced} produced`;
      return evt.type;
    case 'grade':
      return `batch graded:${evt.graded} kept:${evt.kept} rej:${evt.rejected} oos:${evt.outOfScope}`;
    case 'cluster':
    case 'score':
    case 'select':
      return `done (count: ${evt.count})`;
    case 'run':
      return `complete pages:${evt.pages} selected:${evt.selected} spend:$${evt.spend.toFixed(4)}`;
    default:
      return JSON.stringify(evt);
  }
}

// ---------------------------------------------------------------------------
// ExplanationBanner - plain-English prose per event type
// ---------------------------------------------------------------------------

export function ExplanationBanner({ text }: { text: string }): React.ReactElement {
  return (
    <p
      className="text-[11px] text-on-surface-muted italic mb-2"
      data-testid="explanation-banner"
    >
      {text}
    </p>
  );
}

function explanationFor(evt: RunEvent): string {
  switch (evt.stage) {
    case 'planner':
      return `Orchestrator decided to run: ${evt.step}. ${evt.rationale}`;
    case 'seed-gen':
      return evt.type === 'done'
        ? `Generated ${evt.count ?? 0} brand-free seed keywords for this offering (the starting points for expansion).`
        : 'Seed keyword generation has started.';
    case 'angle-derivation':
      return evt.type === 'done'
        ? 'Angle derivation completed.'
        : 'Angle derivation has started.';
    case 'broad-match':
      return evt.type === 'expand'
        ? 'A seed keyword was expanded into broad-match variants.'
        : 'Broad-match results were re-fed into the pipeline.';
    case 'lane':
      return 'The lane agent executed a tool call.';
    case 'name-expansion':
      return 'Name expansion generated keyword variants.';
    case 'mine-serp':
      if (evt.type === 'keyword') return "A keyword's SERP was analysed for competitor signals.";
      if (evt.type === 'patterns') {
        if (!evt.triggered) return 'SERP trends sub-agent did not run this step.';
        if (evt.modifiers.length === 0 && evt.candidateTerms.length === 0) {
          return 'SERP trends sub-agent ran but found no patterns this step.';
        }
        return 'Trend patterns were extracted from SERP titles.';
      }
      return 'SERP mining completed for this resource.';
    case 'geo':
      return 'Geo keyword generation completed.';
    case 'pre-gate':
      return 'Pre-grade filtering removed low-signal keywords.';
    case 'grade':
      return evt.type === 'batch'
        ? `Scored ${evt.graded} keywords 0-100 for relevance + buyer intent against the offering; kept ${evt.kept} (avg ${evt.avgScore.toFixed(2)}), rejected ${evt.rejected}, out-of-scope ${evt.outOfScope}. Kept terms have score >= the keep threshold.`
        : 'A batch of keywords was graded by the AI scorer.';
    case 'cluster':
      return 'Keywords were clustered into topic groups.';
    case 'score':
      return 'Keywords were assigned final scores.';
    case 'select':
      return 'Top keywords were selected for the final output.';
    case 'run':
      return `Run complete: ${evt.selected} keywords selected across ${evt.pages} candidate pages, total spend $${evt.spend.toFixed(4)}.`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Expanded detail content per event type
// ---------------------------------------------------------------------------

export function ExpandedDetail({ evt }: { evt: RunEvent }): React.ReactElement {
  const bannerText = explanationFor(evt);

  if (evt.stage === 'mine-serp' && evt.type === 'keyword') {
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-on-surface-muted">Keyword</dt>
          <dd className="font-mono text-on-surface">{evt.keyword}</dd>
          <dt className="text-on-surface-muted">Titles seen</dt>
          <dd className="font-mono text-on-surface">{evt.titlesSeen}</dd>
          <dt className="text-on-surface-muted">Competitor domains</dt>
          <dd className="font-mono text-on-surface">{evt.competitorDomains}</dd>
          <dt className="text-on-surface-muted">Ranked pulled</dt>
          <dd className="font-mono text-on-surface">{evt.rankedPulled ? 'yes' : 'no'}</dd>
        </dl>
      </div>
    );
  }

  if (evt.stage === 'mine-serp' && evt.type === 'patterns') {
    if (!evt.triggered) {
      return (
        <div>
          {bannerText && <ExplanationBanner text={bannerText} />}
        </div>
      );
    }
    if (evt.modifiers.length === 0 && evt.candidateTerms.length === 0) {
      return (
        <div>
          {bannerText && <ExplanationBanner text={bannerText} />}
          <p className="text-[11px] text-on-surface-muted italic">
            Triggered, no patterns found
          </p>
          <p className="text-[11px] text-on-surface-muted italic">
            No modifiers or candidate terms were extracted this step.
          </p>
          {evt.traceId && (
            <p className="text-[11px] font-mono text-on-surface-muted mt-1">
              Portkey trace: {evt.traceId}
            </p>
          )}
        </div>
      );
    }
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <div className="text-[11px] space-y-1">
          {evt.modifiers.length > 0 && (
            <div>
              <span className="text-on-surface-muted mr-1">Detected modifiers:</span>
              <span className="font-mono text-on-surface">{evt.modifiers.join(', ')}</span>
            </div>
          )}
          {evt.candidateTerms.length > 0 && (
            <div>
              <span className="text-on-surface-muted mr-1">Synthesized candidate keywords:</span>
              <span className="font-mono text-on-surface">{evt.candidateTerms.join(', ')}</span>
            </div>
          )}
          {evt.traceId && (
            <p className="text-[11px] font-mono text-on-surface-muted mt-1">
              Portkey trace: {evt.traceId}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (evt.stage === 'lane' && evt.type === 'agent-step') {
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-on-surface-muted">Tool</dt>
          <dd className="font-mono text-on-surface">{evt.tool}</dd>
          {evt.produced != null && (
            <>
              <dt className="text-on-surface-muted">Produced</dt>
              <dd className="font-mono text-on-surface">{evt.produced}</dd>
            </>
          )}
          {evt.kept != null && (
            <>
              <dt className="text-on-surface-muted">Kept</dt>
              <dd className="font-mono text-on-surface">{evt.kept}</dd>
            </>
          )}
        </dl>
        {evt.traceId && (
          <p className="text-[11px] font-mono text-on-surface-muted mt-1">
            Portkey trace: {evt.traceId}
          </p>
        )}
      </div>
    );
  }

  if (evt.stage === 'grade' && evt.type === 'batch') {
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-on-surface-muted">Graded</dt>
          <dd className="font-mono text-on-surface">{evt.graded}</dd>
          <dt className="text-on-surface-muted">Kept</dt>
          <dd className="font-mono text-on-surface">{evt.kept}</dd>
          <dt className="text-on-surface-muted">Rejected</dt>
          <dd className="font-mono text-on-surface">{evt.rejected}</dd>
          <dt className="text-on-surface-muted">Out of scope</dt>
          <dd className="font-mono text-on-surface">{evt.outOfScope}</dd>
          <dt className="text-on-surface-muted">Avg score</dt>
          <dd className="font-mono text-on-surface">{evt.avgScore.toFixed(2)}</dd>
        </dl>
        {evt.traceId && (
          <p className="text-[11px] font-mono text-on-surface-muted mt-1">
            Portkey trace: {evt.traceId}
          </p>
        )}
      </div>
    );
  }

  if (evt.stage === 'pre-gate' && evt.type === 'done') {
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-on-surface-muted">Kept</dt>
          <dd className="font-mono text-on-surface">{evt.kept}</dd>
          <dt className="text-on-surface-muted">Dropped</dt>
          <dd className="font-mono text-on-surface">{evt.dropped}</dd>
        </dl>
      </div>
    );
  }

  if (evt.stage === 'geo' && evt.type === 'done') {
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-on-surface-muted">Heads x cities</dt>
          <dd className="font-mono text-on-surface">{evt.heads} x {evt.cities}</dd>
          <dt className="text-on-surface-muted">Combos tried</dt>
          <dd className="font-mono text-on-surface">{evt.combosTried}</dd>
          <dt className="text-on-surface-muted">Kept</dt>
          <dd className="font-mono text-on-surface">{evt.kept}</dd>
        </dl>
      </div>
    );
  }

  if (evt.stage === 'planner' && evt.type === 'decision') {
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-on-surface-muted">Step</dt>
          <dd className="font-mono text-on-surface">{evt.step}</dd>
          <dt className="text-on-surface-muted">Rationale</dt>
          <dd className="font-mono text-on-surface">{evt.rationale}</dd>
        </dl>
      </div>
    );
  }

  if (evt.stage === 'mine-serp' && evt.type === 'done') {
    const patternKept = evt.patternKept;
    const competitorKept = evt.competitorKept;
    const patternLine = patternKept === 0
      ? '0 novel pattern keywords survived dedup (they overlapped with broad-match terms already kept)'
      : patternKept != null
        ? `Of the trends candidate keywords, ${patternKept} were kept and re-fed into broad-match`
        : null;
    const competitorLine = competitorKept === 0
      ? '0 competitor keywords kept'
      : competitorKept != null
        ? `${competitorKept} competitor keywords kept`
        : null;
    return (
      <div>
        {bannerText && <ExplanationBanner text={bannerText} />}
        <p className="text-[11px] font-mono text-on-surface break-all">{evt.detail}</p>
        {patternLine && (
          <p className="text-[11px] text-on-surface mt-1">{patternLine}</p>
        )}
        {competitorLine && (
          <p className="text-[11px] text-on-surface mt-0.5">{competitorLine}</p>
        )}
      </div>
    );
  }

  // Fallback: show banner + detail string (covers seed-gen, angle-derivation,
  // broad-match, name-expansion, cluster, score, select, run, and unknowns)
  const detail = 'detail' in evt ? (evt as { detail?: string }).detail : undefined;
  return (
    <div>
      {bannerText && <ExplanationBanner text={bannerText} />}
      <p className="text-[11px] font-mono text-on-surface break-all">
        {detail ?? JSON.stringify(evt)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface EventRowProps {
  evt: RunEvent;
  expanded: boolean;
  onToggle: () => void;
  sameStageAsPrev: boolean;
}

const EventRow = React.memo(function EventRow({ evt, expanded, onToggle, sameStageAsPrev }: EventRowProps) {
  // Subtle left-border accent when consecutive rows share the same stage
  const groupingStyle: React.CSSProperties = sameStageAsPrev
    ? { borderLeftWidth: '2px', borderLeftStyle: 'solid', borderLeftColor: 'rgba(var(--color-primary-rgb, 99,102,241)/0.4)' }
    : {};

  return (
    <div className="border-b border-border last:border-0" style={groupingStyle}>
      {/* Collapsed header - always visible */}
      <div className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-surface-muted">
        {/* Expand/collapse button */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse event details' : 'Expand event details'}
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 text-on-surface-muted hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
        >
          {expanded ? (
            <ChevronDown size={12} aria-hidden="true" />
          ) : (
            <ChevronRight size={12} aria-hidden="true" />
          )}
        </button>
        {/* Timestamp */}
        <span className="font-mono tabular-nums text-on-surface-muted flex-shrink-0 w-[60px]">
          {formatTs(evt.ts)}
        </span>
        {/* Stage badge */}
        <span
          className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${stageBadgeClass(evt.stage)}`}
          aria-label={`Stage: ${evt.stage}`}
        >
          {evt.stage}
          {'type' in evt && typeof (evt as { type?: string }).type === 'string'
            ? `/${(evt as { type: string }).type}`
            : ''}
        </span>
        {/* Summary */}
        <span className="text-on-surface font-mono text-[11px] flex-1 min-w-0 truncate">
          {eventSummary(evt)}
        </span>
      </div>
      {/* Expanded detail */}
      {expanded && (
        <div className="px-10 pb-2 pt-0">
          <ExpandedDetail evt={evt} />
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// EventLogRows - inner component; keyed by selectedStage so expand state
// resets automatically when the stage filter changes.
// ---------------------------------------------------------------------------

interface EventLogRowsProps {
  visible: RunEvent[];
  filteredCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

function EventLogRows({ visible, filteredCount, scrollRef }: EventLogRowsProps) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  // Gated auto-scroll: only scroll when already near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || visible.length === 0) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, scrollRef]);

  const handleToggle = useCallback((index: number) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <>
      {filteredCount > MAX_VISIBLE && (
        <div className="px-3 py-1 text-[10px] text-on-surface-muted bg-surface-muted border-b border-border">
          Showing last {MAX_VISIBLE} of {filteredCount} events
        </div>
      )}
      {visible.map((evt, idx) => (
        <EventRow
          key={`${evt.ts}-${evt.stage}-${idx}`}
          evt={evt}
          expanded={expandedSet.has(idx)}
          onToggle={() => handleToggle(idx)}
          sameStageAsPrev={idx > 0 && visible[idx - 1]!.stage === evt.stage}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// EventLog
// ---------------------------------------------------------------------------

interface EventLogProps {
  log: RunEvent[];
  selectedStage: string | null;
}

export default function EventLog({ log, selectedStage }: EventLogProps) {
  const filtered = selectedStage
    ? log.filter((evt) => {
        const displayStage = evt.stage === 'run' ? 'result' : evt.stage;
        return displayStage === selectedStage || evt.stage === selectedStage;
      })
    : log;

  // Cap to last MAX_VISIBLE events
  const visible = filtered.length > MAX_VISIBLE
    ? filtered.slice(filtered.length - MAX_VISIBLE)
    : filtered;

  const parentRef = useRef<HTMLDivElement>(null);

  if (visible.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-32 text-sm text-on-surface-muted"
        role="status"
        aria-live="polite"
      >
        {selectedStage
          ? `No events for stage "${selectedStage}" yet.`
          : 'Waiting for events...'}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded-b-lg"
      style={{ height: '280px' }}
      role="log"
      aria-label="Pipeline event log"
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
    >
      {/* Key on selectedStage resets expanded state when the filter changes */}
      <EventLogRows
        key={selectedStage ?? '__all__'}
        visible={visible}
        filteredCount={filtered.length}
        scrollRef={parentRef}
      />
    </div>
  );
}
