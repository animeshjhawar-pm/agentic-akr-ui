'use client';

/**
 * RunHistory
 *
 * Lists persisted runs from GET /api/runs.
 * Selecting a run fetches its stored events from GET /api/runs/[id],
 * replays them through replayEvents (same reducer as live runs),
 * and renders a read-only ExecutionView + Results for that run.
 */

import React, { useEffect, useState } from 'react';
import { History, ChevronRight, Loader, AlertCircle } from 'lucide-react';
import type { RunEvent } from '@/lib/events';
import { replayEvents } from '@/lib/useRunStream';
import StateMachine from './StateMachine';
import EventLog from './EventLog';
import Results from './Results';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReplayViewProps {
  runId: string;
}

// ---------------------------------------------------------------------------
// ReplayView -- renders a completed run's state + results (read-only)
// ---------------------------------------------------------------------------

function ReplayView({ runId }: ReplayViewProps) {
  const [events, setEvents] = useState<RunEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/runs/${runId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { runId: string; events: RunEvent[] };
        if (!cancelled) {
          setEvents(data.events ?? []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load run events');
          setLoading(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-on-surface-muted" aria-label="Loading run">
        <Loader size={16} aria-hidden="true" className="motion-safe:animate-spin" />
        <span className="text-sm">Loading run...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-danger" role="alert">
        <AlertCircle size={14} aria-hidden="true" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <p className="text-sm text-on-surface-muted py-4">No events recorded for this run.</p>
    );
  }

  const reduced = replayEvents(events);
  const { stages, log, totals } = reduced;

  return (
    <div className="flex flex-col gap-4">
      {/* Run identifier */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-on-surface">
          Replay{' '}
          <span className="font-mono text-on-surface-muted text-xs">{runId}</span>
        </h3>
        <span className="inline-flex items-center gap-1 text-xs text-on-surface-muted bg-surface-muted px-2 py-0.5 rounded">
          Read-only replay
        </span>
      </div>

      {/* State machine (static -- all stages reflect final state) */}
      <section aria-label="Stage diagram (replay)">
        <StateMachine stages={stages} selectedStage={null} onSelectStage={() => undefined} />
      </section>

      {/* Event log */}
      <section aria-label="Event log (replay)">
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface-muted flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface">Event Log</span>
            <span className="text-xs tabular-nums text-on-surface-muted">
              {log.length} event{log.length !== 1 ? 's' : ''}
            </span>
          </div>
          <EventLog log={log} selectedStage={null} />
        </div>
      </section>

      {/* Results */}
      <section aria-label="Keyword results (replay)">
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <Results runId={runId} totals={totals} />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RunHistory
// ---------------------------------------------------------------------------

export default function RunHistory() {
  const [runs, setRuns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/runs');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { runs: string[] };
        setRuns(data.runs ?? []);
        setLoading(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load run history');
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <History size={14} aria-hidden="true" className="text-on-surface-muted" />
        <h2 className="text-sm font-semibold text-on-surface">Run History</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-on-surface-muted" aria-label="Loading runs">
          <Loader size={14} aria-hidden="true" className="motion-safe:animate-spin" />
          <span className="text-xs">Loading...</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-danger" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <p className="text-xs text-on-surface-muted">No previous runs found.</p>
      )}

      {/* Run list */}
      {!loading && !error && runs.length > 0 && (
        <ul className="flex flex-col gap-1" role="list" aria-label="Previous runs">
          {runs.map((runId) => (
            <li key={runId}>
              <button
                type="button"
                onClick={() => setSelectedRun((prev) => (prev === runId ? null : runId))}
                aria-pressed={selectedRun === runId}
                className={[
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs cursor-pointer min-h-[44px]',
                  'motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                  selectedRun === runId
                    ? 'bg-primary/10 border border-primary/30 text-primary'
                    : 'bg-surface border border-border text-on-surface hover:bg-surface-muted',
                ].join(' ')}
              >
                <span className="font-mono truncate">{runId}</span>
                <ChevronRight
                  size={12}
                  aria-hidden="true"
                  className={`shrink-0 motion-safe:transition-transform ${selectedRun === runId ? 'rotate-90' : ''}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Replay panel */}
      {selectedRun && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <ReplayView runId={selectedRun} />
        </div>
      )}
    </div>
  );
}
