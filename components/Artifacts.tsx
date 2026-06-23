'use client';

/**
 * Artifacts
 *
 * Lists persisted run artifacts from GET /api/runs/:id/artifacts -- lane outputs,
 * steps, checkpoints, planner decisions, substeps. Each row is expandable to view
 * its JSON payload, with a per-artifact download. Empty until the engine change
 * that writes run_artifacts is deployed.
 */

import React, { useEffect, useState } from 'react';
import { Loader, AlertCircle, ChevronRight, Download, FileBox } from 'lucide-react';
import Tooltip from './Tooltip';

const ARTIFACTS_HELP =
  "Raw pipeline outputs captured during the run. Kind: lane-output (a resource lane's final state), lane-step (one agent step), checkpoint (lane snapshot), planner-decision (orchestrator choice), substep:NN (a clustering-tail stage), db-snapshot (SQLite size only). The chip is the resource it belongs to; #N is its order within that kind. Click a row to view/download its JSON.";

interface ArtifactRow {
  id: number;
  kind: string;
  resourceId: string | null;
  seq: number | null;
  payload: unknown;
  createdAt: string | null;
}

interface ArtifactsProps {
  runId: string;
  resourceNames?: Record<string, string>;
}

const KIND_LABEL: Record<string, string> = {
  'lane-output': 'Lane output',
  'lane-step': 'Lane step',
  checkpoint: 'Checkpoint',
  'planner-decision': 'Planner decision',
  'db-snapshot': 'DB snapshot',
};

function kindLabel(kind: string): string {
  if (kind.startsWith('substep:')) return `Substep (${kind.slice('substep:'.length)})`;
  return KIND_LABEL[kind] ?? kind;
}

function ArtifactItem({ a, resourceNames }: { a: ArtifactRow; resourceNames?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(a.payload, null, 2);
  const resLabel = a.resourceId ? (resourceNames?.[a.resourceId] ?? a.resourceId) : null;

  function download() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${a.kind.replace(/[^a-z0-9-]/gi, '_')}-${a.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <li className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary rounded"
        >
          <ChevronRight
            size={12}
            aria-hidden="true"
            className={`shrink-0 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="text-xs font-medium text-on-surface">{kindLabel(a.kind)}</span>
          {a.seq != null && <span className="text-[10px] text-on-surface-muted">#{a.seq}</span>}
          {resLabel && (
            <span className="truncate rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-on-surface-muted">
              {resLabel}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label="Download artifact JSON"
          onClick={download}
          className="shrink-0 p-1.5 rounded hover:bg-surface-muted text-on-surface-muted cursor-pointer flex items-center justify-center min-h-[32px] min-w-[32px]"
        >
          <Download size={13} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <pre className="overflow-auto border-t border-border bg-surface-muted px-3 py-2 text-[11px] text-on-surface max-h-[40vh]">
          {json}
        </pre>
      )}
    </li>
  );
}

export default function Artifacts({ runId, resourceNames }: ArtifactsProps) {
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/runs/${runId}/artifacts`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { artifacts: ArtifactRow[] };
        if (!cancelled) {
          setArtifacts(Array.isArray(data.artifacts) ? data.artifacts : []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artifacts');
          setLoading(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-on-surface-muted" aria-label="Loading artifacts">
        <Loader size={16} aria-hidden="true" className="motion-safe:animate-spin" />
        <span className="text-sm">Loading artifacts...</span>
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

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-on-surface-muted">
        <FileBox size={28} aria-hidden="true" className="opacity-30" />
        <p className="text-sm">No artifacts recorded for this run.</p>
      </div>
    );
  }

  return (
    <section aria-label="Run artifacts" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FileBox size={14} aria-hidden="true" className="text-on-surface-muted" />
        <h3 className="text-sm font-semibold text-on-surface">Artifacts</h3>
        <span className="text-xs text-on-surface-muted">({artifacts.length})</span>
        <Tooltip description={ARTIFACTS_HELP} />
      </div>
      <ul className="flex flex-col gap-1.5" role="list">
        {artifacts.map((a) => (
          <ArtifactItem key={a.id} a={a} resourceNames={resourceNames} />
        ))}
      </ul>
    </section>
  );
}
