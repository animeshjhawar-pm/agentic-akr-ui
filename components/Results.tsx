'use client';

/**
 * Results
 *
 * Displays the keyword results for a completed run:
 * - Totals header: selected count, pages, spend
 * - Sortable table: term, volume, KD, score, source, resource
 *   - Clickable column headers with aria-sort
 *   - Tabular-nums for numeric columns
 *   - Score shown as 0-100 rounded integer
 * - "Download CSV" button: exports all rows as a CSV file
 */

import React, { useEffect, useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
} from 'lucide-react';
import { toKeywordsCsv } from '@/lib/csv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Keyword {
  term: string;
  volume: number;
  kd: number;
  score: number;
  intent: string;
  source: string;
  resourceId: string;
}

export interface ResultsTotals {
  spend: number;
  selected: number;
  pages: number;
}

interface ResultsProps {
  runId: string;
  totals: ResultsTotals;
  /** Optional map of resourceId -> display name for the Resource column */
  resourceNames?: Record<string, string>;
}

type SortKey = 'term' | 'volume' | 'kd' | 'score' | 'intent';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (column !== sortKey) return <ChevronsUpDown size={12} aria-hidden="true" className="text-on-surface-muted" />;
  if (sortDir === 'asc') return <ChevronUp size={12} aria-hidden="true" className="text-primary" />;
  return <ChevronDown size={12} aria-hidden="true" className="text-primary" />;
}

// ---------------------------------------------------------------------------
// Intent badge
// ---------------------------------------------------------------------------

const INTENT_BADGE_STYLE: Record<string, string> = {
  transactional: 'bg-green-100 text-green-800',
  commercial:    'bg-blue-100 text-blue-800',
  informational: 'bg-yellow-100 text-yellow-800',
  other:         'bg-surface-muted text-on-surface-muted',
};

function IntentBadge({ intent }: { intent: string }) {
  const style = INTENT_BADGE_STYLE[intent] ?? INTENT_BADGE_STYLE['other'];
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${style}`}>
      {intent}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Totals header
// ---------------------------------------------------------------------------

function TotalsHeader({ totals }: { totals: ResultsTotals }) {
  return (
    <div className="flex flex-wrap gap-3" aria-label="Run result totals">
      <div className="flex flex-col items-center bg-surface-muted rounded-lg px-4 py-2 min-w-[80px]">
        <span className="text-base font-semibold tabular-nums text-on-surface">{totals.selected}</span>
        <span className="text-[10px] text-on-surface-muted mt-0.5">Final keywords</span>
      </div>
      <div className="flex flex-col items-center bg-surface-muted rounded-lg px-4 py-2 min-w-[80px]">
        <span className="text-base font-semibold tabular-nums font-mono text-on-surface">${totals.spend.toFixed(4)}</span>
        <span className="text-[10px] text-on-surface-muted mt-0.5">Total spend</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column header button
// ---------------------------------------------------------------------------

function ColHeader({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
  className,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onClick: (col: SortKey) => void;
  className?: string;
}) {
  const ariaSort = col === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      scope="col"
      aria-sort={ariaSort as 'ascending' | 'descending' | 'none'}
      onClick={() => onClick(col)}
      className={`px-3 py-2 text-left text-xs font-semibold text-on-surface-muted select-none cursor-pointer hover:text-on-surface rounded-none ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon column={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export default function Results({ runId, totals, resourceNames }: ResultsProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/runs/${runId}/keywords`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { keywords: Keyword[] };
        if (!cancelled) {
          setKeywords(data.keywords ?? []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load keywords');
          setLoading(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [runId]);

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  }

  function handleDownloadCsv() {
    const csv = toKeywordsCsv(keywords, resourceNames);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `akr-keywords-${runId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const sorted = [...keywords].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    let cmp = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal;
    } else {
      cmp = String(aVal).localeCompare(String(bVal));
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-on-surface">Keyword Results</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <TotalsHeader totals={totals} />
          {keywords.length > 0 && (
            <button
              type="button"
              aria-label="Download CSV"
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-on-surface hover:bg-border cursor-pointer min-h-[36px]"
            >
              <Download size={13} aria-hidden="true" />
              Download CSV
            </button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-2" aria-label="Loading keywords">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-surface-muted rounded" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-sm text-danger" role="alert">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && sorted.length === 0 && (
        <p className="text-sm text-on-surface-muted">No keywords selected for this run.</p>
      )}

      {/* Table */}
      {!loading && !error && sorted.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm border-collapse" aria-label="Selected keywords">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <ColHeader label="Term" col="term" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} />
                <ColHeader label="Volume" col="volume" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} className="text-right" />
                <ColHeader label="KD" col="kd" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} className="text-right" />
                <ColHeader label="Score" col="score" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} className="text-right" />
                <ColHeader label="Intent" col="intent" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-on-surface-muted">Source</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-on-surface-muted">Resource</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kw, i) => (
                <tr
                  key={`${kw.term}-${i}`}
                  className={`border-b border-border last:border-0 ${i % 2 === 1 ? 'bg-surface-muted' : 'bg-surface'}`}
                >
                  <td className="px-3 py-2 text-on-surface font-medium">{kw.term}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono text-on-surface">
                    {kw.volume != null ? kw.volume.toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono text-on-surface">
                    {kw.kd != null ? kw.kd.toFixed(1) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono text-on-surface">
                    {kw.score != null ? Math.round(kw.score) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <IntentBadge intent={kw.intent ?? 'other'} />
                  </td>
                  <td className="px-3 py-2 text-on-surface-muted text-xs">{kw.source ?? '-'}</td>
                  <td className="px-3 py-2 text-on-surface-muted text-xs">
                    {resourceNames?.[kw.resourceId] ?? kw.resourceId ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
