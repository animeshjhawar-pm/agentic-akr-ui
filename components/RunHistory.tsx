'use client';

/**
 * RunHistory -- live run dashboard.
 *
 * Polls GET /api/runs every REFRESH_MS and renders every run (queued, running,
 * complete, failed) as a selectable row with a live status badge. The list is
 * the persisted history AND the live view of in-flight runs -- the engine writes
 * a runs row with status 'running' at start and flips it to complete/failed at
 * the end, so concurrent runs appear and update here without a refresh.
 *
 * Selecting a run renders ExecutionView for it (live polling if running, final
 * state if done -- ExecutionView/useRunPolling handle both via /api/runs/[id]).
 *
 * optimisticRuns lets the parent show a just-triggered run immediately (status
 * 'queued') in the few seconds before the engine claims it and writes its row.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, ChevronRight, Loader, AlertCircle, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Run row as serialized by GET /api/runs (Date fields arrive as ISO strings). */
export interface RunListRow {
  runId: string;
  clientId: string;
  status: string;
  spend: number | null;
  selected: number | null;
  clusters: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  resourceCount?: number | null;
}

/** A just-triggered run the parent wants shown before the server list includes it. */
export interface OptimisticRun {
  runId: string;
  clientId: string;
  resourceCount?: number;
}

interface RunHistoryProps {
  /** Currently opened run (its ExecutionView is rendered below the list). */
  selectedRunId?: string | null;
  /** Called when a row is clicked (toggle: same id again clears selection). */
  onSelectRun?: (runId: string | null) => void;
  /** Runs triggered this session, merged in until the server list catches up. */
  optimisticRuns?: OptimisticRun[];
  /** clientId -> client display name, for the run row labels. */
  clientNames?: Record<string, string>;
  /** When set, the list defaults to showing only this client's runs (with a toggle). */
  scopeClientId?: string | null;
}

const REFRESH_MS = 3000;

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

type Tone = 'running' | 'complete' | 'failed' | 'queued';

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'complete' || s === 'done') return 'complete';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'running' || s === 'claimed') return 'running';
  return 'queued'; // queued | pending | unknown
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const label =
    tone === 'complete' ? 'Complete' : tone === 'failed' ? 'Failed' : tone === 'running' ? 'Running' : 'Queued';
  const cls =
    tone === 'complete'
      ? 'bg-success/10 text-success'
      : tone === 'failed'
        ? 'bg-danger-surface text-danger'
        : tone === 'running'
          ? 'bg-primary/10 text-primary'
          : 'bg-surface-muted text-on-surface-muted';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {tone === 'running' && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function formatStarted(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------
// RunHistory
// ---------------------------------------------------------------------------

export default function RunHistory({
  selectedRunId = null,
  onSelectRun,
  optimisticRuns = [],
  clientNames,
  scopeClientId = null,
}: RunHistoryProps) {
  const [runs, setRuns] = useState<RunListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllClients, setShowAllClients] = useState(false);
  // Uncontrolled fallback when no onSelectRun is provided.
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = onSelectRun ? selectedRunId : internalSelected;
  const clientName = (id: string) => (clientNames && clientNames[id]) || id;

  const fetchRuns = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch('/api/runs', { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { runs: RunListRow[] };
      setRuns(Array.isArray(data.runs) ? data.runs : []);
      setError(null);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the run list on an interval so live runs and newly-triggered runs update.
  useEffect(() => {
    const controller = new AbortController();
    void fetchRuns(controller.signal);
    const id = setInterval(() => {
      void fetchRuns();
    }, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [fetchRuns]);

  // Merge optimistic (just-triggered) runs not yet present in the server list.
  const serverIds = useRef<Set<string>>(new Set());
  serverIds.current = new Set(runs.map((r) => r.runId));
  const merged: RunListRow[] = [
    ...optimisticRuns
      .filter((o) => !serverIds.current.has(o.runId))
      .map((o) => ({
        runId: o.runId,
        clientId: o.clientId,
        status: 'queued',
        spend: null,
        selected: null,
        clusters: null,
        startedAt: null,
        finishedAt: null,
        resourceCount: o.resourceCount ?? null,
      })),
    ...runs,
  ];

  // Scope to the selected client unless the user opts to show all clients.
  const scoped =
    scopeClientId && !showAllClients ? merged.filter((r) => r.clientId === scopeClientId) : merged;

  const handleSelect = useCallback(
    (runId: string) => {
      const next = selected === runId ? null : runId;
      if (onSelectRun) onSelectRun(next);
      else setInternalSelected(next);
    },
    [selected, onSelectRun],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History size={14} aria-hidden="true" className="text-on-surface-muted" />
          <h2 className="text-sm font-semibold text-on-surface">Runs</h2>
          <span className="text-xs text-on-surface-muted">({scoped.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {scopeClientId && (
            <button
              type="button"
              onClick={() => setShowAllClients((v) => !v)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-on-surface hover:bg-surface-muted cursor-pointer"
            >
              {showAllClients ? 'This client only' : 'Show all clients'}
            </button>
          )}
          <button
            type="button"
            aria-label="Refresh runs"
            onClick={() => void fetchRuns()}
            className="p-1.5 rounded hover:bg-surface-muted text-on-surface-muted cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px]"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
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

      {!loading && !error && scoped.length === 0 && (
        <p className="text-xs text-on-surface-muted">No runs yet. Trigger one from the panel on the left.</p>
      )}

      {/* Run list */}
      {scoped.length > 0 && (
        <ul className="flex flex-col gap-1" role="list" aria-label="Runs">
          {scoped.map((run) => {
            const isOpen = selected === run.runId;
            return (
              <li key={run.runId}>
                <button
                  type="button"
                  onClick={() => handleSelect(run.runId)}
                  aria-pressed={isOpen}
                  className={[
                    'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-xs cursor-pointer min-h-[44px]',
                    'motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                    isOpen
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-surface border border-border hover:bg-surface-muted',
                  ].join(' ')}
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    {/* Top label: status + client name + resources chosen */}
                    <span className="flex items-center gap-2 min-w-0">
                      <StatusBadge status={run.status} />
                      <span className="font-semibold text-on-surface truncate">{clientName(run.clientId)}</span>
                      {run.resourceCount != null && (
                        <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-on-surface-muted">
                          {run.resourceCount} resource{run.resourceCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    {/* Run id underneath */}
                    <span className="font-mono text-[10px] text-on-surface-muted truncate">{run.runId}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0 text-on-surface-muted">
                    {run.clusters != null && <span className="tabular-nums">{run.clusters} pages</span>}
                    <span className="hidden sm:inline tabular-nums">{formatStarted(run.startedAt)}</span>
                    <ChevronRight
                      size={12}
                      aria-hidden="true"
                      className={`motion-safe:transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
