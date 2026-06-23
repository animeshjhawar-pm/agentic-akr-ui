'use client';

/**
 * ExecutionView
 *
 * Composes:
 *   - Totals header (always visible above tabs)
 *   - Tabbed layout: Commentary | Events | Keywords | Clusters
 *
 * The "Events" tab shows the event log with a Linear / Tree view toggle.
 *
 * Consumes useRunPolling(runId) -- polls Supabase via /api/runs/:id.
 * The Artifacts tab is hidden in the hosted UI (local-only feature).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { useRunPolling } from '@/lib/useRunPolling';
import { isoToMs } from '@/lib/formatDuration';
import RunTimer from './RunTimer';
import Commentary from './Commentary';
import EventLog from './EventLog';
import TreeEventLog from './TreeEventLog';
import Results from './Results';
import Clusters from './Clusters';
import Artifacts from './Artifacts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecutionViewProps {
  runId: string;
  /** Optional resourceId -> display name map, threaded to Results/CSV. */
  resourceNames?: Record<string, string>;
  /**
   * Fired once when the polling detects the run is done (streamDone flips true),
   * so the parent can move the run lifecycle to 'done' and re-enable RunConfig.
   */
  onStreamDone?: () => void;
}

// ---------------------------------------------------------------------------
// TotalsHeader -- always rendered above the tabs
// ---------------------------------------------------------------------------

interface TotalsHeaderProps {
  spend: number;
  selected: number;
  pages: number;
  streamDone: boolean;
  stalled: boolean;
  /** Origin for the time-taken counter (started, else queued). */
  startMs: number | null;
  /** End for the time-taken counter; null while running -> live ticking. */
  endMs: number | null;
}

function TotalsHeader({ spend, selected, pages, streamDone, stalled, startMs, endMs }: TotalsHeaderProps) {
  // Three distinct states: Complete (done) > Stalled (open but silent) > Running.
  const statusLabel = streamDone ? 'Complete' : stalled ? 'Stalled' : 'Running';
  const iconClass = streamDone
    ? 'text-success'
    : stalled
      ? 'text-warning'
      : 'text-primary motion-safe:animate-pulse';
  const textClass = streamDone
    ? 'text-success'
    : stalled
      ? 'text-warning'
      : 'text-primary';

  return (
    <div
      className="flex flex-wrap items-center gap-6"
      role="status"
      aria-label="Run totals"
      aria-live="polite"
    >
      {/* Status */}
      <div className="bg-surface-muted rounded-lg px-3 py-2 flex items-center gap-1.5">
        {stalled && !streamDone ? (
          <AlertTriangle size={14} aria-hidden="true" className={iconClass} />
        ) : (
          <Activity size={14} aria-hidden="true" className={iconClass} />
        )}
        <span className={`text-xs font-semibold ${textClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* Time taken -- live counter while running, frozen total when done */}
      <div className="flex flex-col items-center gap-0.5 bg-surface-muted rounded-lg px-3 py-2">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          <RunTimer startMs={startMs} endMs={endMs} />
        </span>
        <span className="text-[10px] text-on-surface-muted">Time</span>
      </div>

      {/* Spend */}
      <div className="flex flex-col items-center gap-0.5 bg-surface-muted rounded-lg px-3 py-2">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          ${spend.toFixed(4)}
        </span>
        <span className="text-[10px] text-on-surface-muted">Spend</span>
      </div>

      {/* Selected */}
      <div className="flex flex-col items-center gap-0.5 bg-surface-muted rounded-lg px-3 py-2">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {selected}
        </span>
        <span className="text-[10px] text-on-surface-muted">Selected</span>
      </div>

      {/* Pages */}
      <div className="flex flex-col items-center gap-0.5 bg-surface-muted rounded-lg px-3 py-2">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {pages}
        </span>
        <span className="text-[10px] text-on-surface-muted">Pages</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewToggle -- Linear / Tree switcher for the event log section
// ---------------------------------------------------------------------------

type EventView = 'tree' | 'linear';

interface ViewToggleProps {
  view: EventView;
  onChange: (v: EventView) => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Event view">
      <button
        type="button"
        aria-pressed={view === 'linear'}
        onClick={() => onChange('linear')}
        className={[
          'px-2 py-0.5 text-xs rounded transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          view === 'linear'
            ? 'bg-primary text-on-primary font-semibold'
            : 'text-on-surface-muted hover:text-on-surface hover:bg-surface-muted',
        ].join(' ')}
      >
        Linear
      </button>
      <button
        type="button"
        aria-pressed={view === 'tree'}
        onClick={() => onChange('tree')}
        className={[
          'px-2 py-0.5 text-xs rounded transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          view === 'tree'
            ? 'bg-primary text-on-primary font-semibold'
            : 'text-on-surface-muted hover:text-on-surface hover:bg-surface-muted',
        ].join(' ')}
      >
        Tree
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab ids
// ---------------------------------------------------------------------------

type TabId = 'commentary' | 'events' | 'keywords' | 'clusters' | 'artifacts';

const TABS: { id: TabId; label: string }[] = [
  { id: 'commentary', label: 'Commentary' },
  { id: 'events', label: 'Events' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'artifacts', label: 'Artifacts' },
];

function tabButtonId(id: TabId) {
  return `ev-tab-${id}`;
}

function tabPanelId(id: TabId) {
  return `ev-panel-${id}`;
}

// ---------------------------------------------------------------------------
// ExecutionView
// ---------------------------------------------------------------------------

export default function ExecutionView({ runId, resourceNames, onStreamDone }: ExecutionViewProps) {
  const {
    stages,
    log,
    totals,
    streamDone,
    stalled,
    liveSpend,
    liveSelected,
    liveClusters,
    startedAt,
    finishedAt,
    createdAt,
    finishedClientMs,
  } = useRunPolling(runId);
  // Prefer live totals from the runs row (spend updates in real time); fall back
  // to event-derived totals (which only fill in at run completion).
  const headerSpend = liveSpend ?? totals.spend;
  const headerSelected = liveSelected ?? totals.selected;
  const headerPages = liveClusters ?? totals.pages;

  // Time taken: anchor on when the run was queued (the moment Run was clicked),
  // falling back to the engine start. createdAt-first keeps the origin STABLE for
  // the run's lifetime -- it never migrates to the later started_at, so the live
  // counter cannot jump backward at the queued -> running transition.
  const timerStartMs = isoToMs(createdAt) ?? isoToMs(startedAt);
  // Freeze the counter when the run ends. Prefer the server finished_at; fall
  // back to the client end captured by useRunPolling at termination (covers the
  // case where finished_at lands a poll late after a RunComplete event).
  const timerEndMs = isoToMs(finishedAt) ?? finishedClientMs;

  // Notify the parent exactly once when the run finishes, so the run
  // lifecycle can advance to 'done' (re-enabling RunConfig for a new run).
  const notifiedDoneRef = useRef(false);
  useEffect(() => {
    if (streamDone && !notifiedDoneRef.current) {
      notifiedDoneRef.current = true;
      onStreamDone?.();
    }
  }, [streamDone, onStreamDone]);

  // Current active tab
  const [activeTab, setActiveTab] = useState<TabId>('events');

  // Event view within the Events tab: default Tree
  const [eventView, setEventView] = useState<EventView>('tree');

  // Track whether the user has manually changed the tab since the last auto-switch
  const userPickedRef = useRef(false);

  // Auto-switch to Keywords once when streamDone becomes true -- but only if
  // the user has not manually picked a different tab after that.
  const autoSwitchedRef = useRef(false);

  useEffect(() => {
    if (streamDone && !autoSwitchedRef.current && !userPickedRef.current) {
      autoSwitchedRef.current = true;
      setActiveTab('keywords');
    }
  }, [streamDone]);

  const handleTabClick = useCallback((id: TabId) => {
    // After the first manual click, suppress further auto-switches
    userPickedRef.current = true;
    setActiveTab(id);
  }, []);

  // Roving tabindex: arrow keys move focus between tabs
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let next: number | null = null;
      if (e.key === 'ArrowRight') {
        next = (index + 1) % TABS.length;
      } else if (e.key === 'ArrowLeft') {
        next = (index - 1 + TABS.length) % TABS.length;
      }
      if (next !== null) {
        e.preventDefault();
        tabRefs.current[next]?.focus();
      }
    },
    [],
  );

  // stages is returned by useRunPolling but we no longer render pipeline visuals;
  // keep the variable to avoid unused-import lint errors from the hook return.
  void stages;

  return (
    <div className="flex flex-col gap-4">
      {/* Run ID + totals -- always above tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap py-2 border-b border-border">
        <h2 className="text-sm font-semibold text-on-surface">
          Run{' '}
          <span className="font-mono text-on-surface-muted text-xs">{runId}</span>
        </h2>
        <TotalsHeader
          spend={headerSpend}
          selected={headerSelected}
          pages={headerPages}
          streamDone={streamDone}
          stalled={stalled}
          startMs={timerStartMs}
          endMs={timerEndMs}
        />
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Execution view sections"
        className="flex gap-0 border-b border-border"
      >
        {TABS.map(({ id, label }, index) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              ref={(el) => { tabRefs.current[index] = el; }}
              id={tabButtonId(id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={tabPanelId(id)}
              tabIndex={isActive ? 0 : -1}
              type="button"
              onClick={() => handleTabClick(id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-muted hover:text-on-surface hover:border-border',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}

      {/* Commentary */}
      {activeTab === 'commentary' && (
        <div
          id={tabPanelId('commentary')}
          role="tabpanel"
          aria-labelledby={tabButtonId('commentary')}
          className="flex flex-col gap-4"
        >
          <section aria-label="Pipeline commentary">
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border bg-surface-muted flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Commentary</span>
              </div>
              <Commentary events={log} />
            </div>
          </section>
        </div>
      )}

      {/* Events */}
      {activeTab === 'events' && (
        <div
          id={tabPanelId('events')}
          role="tabpanel"
          aria-labelledby={tabButtonId('events')}
          className="flex flex-col gap-4"
        >
          {/* Event log section */}
          <section aria-label="Event log">
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border bg-surface-muted flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Event Log</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-on-surface-muted">
                    {log.length} event{log.length !== 1 ? 's' : ''}
                  </span>
                  <ViewToggle view={eventView} onChange={setEventView} />
                </div>
              </div>
              {eventView === 'tree' ? (
                <TreeEventLog log={log} selectedStage={null} />
              ) : (
                <EventLog log={log} selectedStage={null} />
              )}
            </div>
          </section>
        </div>
      )}

      {/* Keywords */}
      {activeTab === 'keywords' && (
        <div
          id={tabPanelId('keywords')}
          role="tabpanel"
          aria-labelledby={tabButtonId('keywords')}
        >
          <section aria-label="Keywords">
            {streamDone ? (
              <div className="rounded-xl border border-border bg-surface p-4">
                <Results runId={runId} totals={totals} resourceNames={resourceNames} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-on-surface-muted">
                Results appear when the run completes.
              </div>
            )}
          </section>
        </div>
      )}

      {/* Clusters */}
      {activeTab === 'clusters' && (
        <div
          id={tabPanelId('clusters')}
          role="tabpanel"
          aria-labelledby={tabButtonId('clusters')}
        >
          <section aria-label="Cluster results">
            <Clusters runId={runId} />
          </section>
        </div>
      )}

      {/* Artifacts */}
      {activeTab === 'artifacts' && (
        <div
          id={tabPanelId('artifacts')}
          role="tabpanel"
          aria-labelledby={tabButtonId('artifacts')}
        >
          <Artifacts runId={runId} resourceNames={resourceNames} />
        </div>
      )}
    </div>
  );
}
