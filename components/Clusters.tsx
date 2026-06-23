'use client';

/**
 * Clusters
 *
 * Fetches and displays the cluster results for a run.
 * Handles loading / empty / error / 404-not-yet-generated states.
 * Provides a JSON download button.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecondaryKeyword {
  term: string;
  volume: number | null;
  kd: number | null;
  score: number;
  intent: string;
}

interface ClusterPage {
  id: string;
  title: string;
  pageType: string;
  intent: 'transactional' | 'commercial' | 'informational' | 'other';
  primaryKeyword: string;
  primaryVolume: number | null;
  secondaryKeywords: SecondaryKeyword[];
  clusterVolume: number;
  relevanceScore: number;
  leadScore: number;
  alreadyRanking: boolean;
  rankingPosition: number | null;
  isLocalVariant: boolean;
  city: string | null;
  competitorTitlesUsed: string[];
}

interface ClustersResult {
  clusters: ClusterPage[];
  meta: {
    totalClusters: number;
    byPageType: Record<string, number>;
    byIntent: Record<string, number>;
    droppedOffTopic: number;
    localVariants: number;
  };
}

interface ClustersProps {
  runId: string;
}

// ---------------------------------------------------------------------------
// Intent badge
// ---------------------------------------------------------------------------

const INTENT_BADGE_STYLE: Record<string, string> = {
  transactional: 'bg-success/10 text-success border border-success/30',
  commercial:    'bg-primary/10 text-primary border border-primary/30',
  informational: 'bg-warning/10 text-warning border border-warning/30',
  other:         'bg-surface-muted text-on-surface-muted border border-border',
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
// Page-type badge color
// ---------------------------------------------------------------------------

const PAGE_TYPE_BADGE_STYLE: Record<string, string> = {
  blog:          'bg-warning/10 text-warning border border-warning/30',
  guide:         'bg-warning/10 text-warning border border-warning/30',
  listicle:      'bg-warning/10 text-warning border border-warning/30',
  service:       'bg-primary/10 text-primary border border-primary/30',
  category:      'bg-success/10 text-success border border-success/30',
  product:       'bg-success/10 text-success border border-success/30',
  comparison:    'bg-danger-surface text-danger border border-danger/30',
  informational: 'bg-warning/10 text-warning border border-warning/30',
  commercial:    'bg-primary/10 text-primary border border-primary/30',
};

function pageTypeBadgeClass(pageType: string): string {
  return PAGE_TYPE_BADGE_STYLE[pageType.toLowerCase()] ?? 'bg-surface-muted text-on-surface border border-border';
}

// ---------------------------------------------------------------------------
// Volume formatter
// ---------------------------------------------------------------------------

function formatVolume(vol: number | null): string {
  if (vol == null) return '--';
  return vol.toLocaleString();
}

// ---------------------------------------------------------------------------
// ClusterCard
// ---------------------------------------------------------------------------

/** Small labeled eyebrow above a value. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
      {children}
    </span>
  );
}

function ClusterCard({ cluster }: { cluster: ClusterPage }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      {/* Topic (title) + page type / intent / badges */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${pageTypeBadgeClass(cluster.pageType)}`}>
            {cluster.pageType}
          </span>
          <IntentBadge intent={cluster.intent} />
          {cluster.alreadyRanking && (
            <span className="bg-success/10 text-success border border-success/30 rounded-full px-2 py-0.5 text-[10px]">
              {cluster.rankingPosition ? `Ranking #${cluster.rankingPosition}` : 'Ranking'}
            </span>
          )}
          {cluster.isLocalVariant && (
            <span className="bg-primary/10 text-primary border border-primary/30 rounded-full px-2 py-0.5 text-[10px]">
              {cluster.city ? `Local - ${cluster.city}` : 'Local'}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Topic</FieldLabel>
          <h3 className="text-sm font-semibold text-on-surface leading-tight">{cluster.title}</h3>
        </div>
      </div>

      {/* Primary keyword */}
      <div className="flex flex-col gap-0.5">
        <FieldLabel>Primary keyword</FieldLabel>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-on-surface">{cluster.primaryKeyword}</span>
          {cluster.primaryVolume != null && (
            <span className="text-[11px] tabular-nums text-on-surface-muted">
              {formatVolume(cluster.primaryVolume)} vol
            </span>
          )}
        </div>
      </div>

      {/* Secondary keywords -- show first SECONDARY_LIMIT, trim the rest behind a
          "+N more" chip that lists them all on hover (keeps long clusters compact). */}
      {cluster.secondaryKeywords.length > 0 && (() => {
        const SECONDARY_LIMIT = 8;
        const shown = cluster.secondaryKeywords.slice(0, SECONDARY_LIMIT);
        const hidden = cluster.secondaryKeywords.slice(SECONDARY_LIMIT);
        return (
          <div className="flex flex-col gap-1">
            <FieldLabel>Secondary keywords ({cluster.secondaryKeywords.length})</FieldLabel>
            <div className="flex flex-wrap gap-1">
              {shown.map((kw) => (
                <span
                  key={kw.term}
                  className="inline-block rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-on-surface-muted"
                  title={kw.volume != null ? `${formatVolume(kw.volume)} vol` : undefined}
                >
                  {kw.term}
                </span>
              ))}
              {hidden.length > 0 && (
                <span
                  className="inline-block rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-on-surface border border-border cursor-default"
                  title={hidden.map((k) => k.term).join(', ')}
                >
                  +{hidden.length} more
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Metrics row */}
      <div className="flex items-center gap-5 text-xs text-on-surface-muted flex-wrap border-t border-border pt-2 mt-auto">
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums font-semibold text-on-surface">
            {formatVolume(cluster.clusterVolume)}
          </span>
          <span className="text-[10px]">Cluster vol</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums font-semibold text-on-surface">
            {Math.round(cluster.relevanceScore)}<span className="text-on-surface-muted font-normal">/100</span>
          </span>
          <span className="text-[10px]">Relevance</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums font-semibold text-on-surface">
            {Math.round(cluster.leadScore)}<span className="text-on-surface-muted font-normal">/100</span>
          </span>
          <span className="text-[10px]">Lead score</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------

export default function Clusters({ runId }: ClustersProps) {
  const [data, setData] = useState<ClustersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notYetGenerated, setNotYetGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setNotYetGenerated(false);
      try {
        const r = await fetch(`/api/runs/${runId}/clusters`);
        if (r.status === 404) {
          if (!cancelled) {
            setNotYetGenerated(true);
            setLoading(false);
          }
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as ClustersResult;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load clusters');
          setLoading(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [runId]);

  // --- Filters / sort (client-side) ---
  const [minRelevance, setMinRelevance] = useState(0);
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'lead' | 'volume'>('relevance');

  const pageTypes = useMemo(
    () => Array.from(new Set((data?.clusters ?? []).map((c) => c.pageType))).sort(),
    [data],
  );

  const visibleClusters = useMemo(() => {
    const list = (data?.clusters ?? []).filter(
      (c) =>
        c.relevanceScore >= minRelevance &&
        (intentFilter === 'all' || c.intent === intentFilter) &&
        (pageTypeFilter === 'all' || c.pageType === pageTypeFilter),
    );
    const key =
      sortBy === 'relevance' ? 'relevanceScore' : sortBy === 'lead' ? 'leadScore' : 'clusterVolume';
    return [...list].sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [data, minRelevance, intentFilter, pageTypeFilter, sortBy]);

  function handleDownloadCsv() {
    if (!data) return;
    const esc = (v: string) =>
      /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const header = [
      'Topic', 'Page Type', 'Intent', 'Primary Keyword', 'Primary Volume',
      'Cluster Volume', 'Relevance', 'Lead Score', 'Already Ranking',
      'Ranking Position', 'City', 'Secondary Keywords',
    ];
    // Export what's currently visible (respects the active filters/sort).
    const rows = visibleClusters.map((c) => [
      c.title,
      c.pageType,
      c.intent,
      c.primaryKeyword,
      c.primaryVolume != null ? String(c.primaryVolume) : '',
      String(c.clusterVolume),
      String(Math.round(c.relevanceScore)),
      String(Math.round(c.leadScore)),
      c.alreadyRanking ? 'yes' : 'no',
      c.rankingPosition != null ? String(c.rankingPosition) : '',
      c.city ?? '',
      c.secondaryKeywords.map((k) => k.term).join(' | '),
    ]);
    const csv = [header, ...rows].map((r) => r.map((f) => esc(String(f))).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Final_Clusters-${runId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-2" aria-label="Loading clusters">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-surface-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (notYetGenerated) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-on-surface-muted">
        Clusters not yet generated for this run.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!data || data.clusters.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-on-surface-muted">
        No clusters in results.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-on-surface">
          Cluster Results
          <span className="ml-2 tabular-nums text-on-surface-muted font-normal">
            ({visibleClusters.length}{visibleClusters.length !== data.clusters.length ? ` of ${data.clusters.length}` : ''})
          </span>
        </h3>
        <button
          type="button"
          aria-label="Download Final_Clusters.csv"
          onClick={handleDownloadCsv}
          className="flex items-center gap-1.5 bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-on-surface hover:bg-border cursor-pointer min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <Download size={13} aria-hidden="true" />
          Download Final_Clusters.csv
        </button>
      </div>

      {/* Filter / sort bar */}
      <div className="flex items-center gap-4 flex-wrap rounded-lg border border-border bg-surface-muted px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-on-surface-muted">
          Min relevance
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minRelevance}
            onChange={(e) => setMinRelevance(Number(e.target.value))}
            aria-label="Minimum relevance score"
            className="accent-primary"
          />
          <span className="tabular-nums text-on-surface w-7">{minRelevance}</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-on-surface-muted">
          Intent
          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            aria-label="Filter by intent"
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="all">All</option>
            <option value="transactional">Transactional</option>
            <option value="commercial">Commercial</option>
            <option value="informational">Informational</option>
            <option value="other">Other</option>
          </select>
        </label>

        {pageTypes.length > 1 && (
          <label className="flex items-center gap-1.5 text-xs text-on-surface-muted">
            Page type
            <select
              value={pageTypeFilter}
              onChange={(e) => setPageTypeFilter(e.target.value)}
              aria-label="Filter by page type"
              className="rounded border border-border bg-surface px-2 py-1 text-xs text-on-surface capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="all">All</option>
              {pageTypes.map((pt) => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-1.5 text-xs text-on-surface-muted ml-auto">
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'lead' | 'volume')}
            aria-label="Sort clusters"
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="relevance">Relevance</option>
            <option value="lead">Lead score</option>
            <option value="volume">Cluster volume</option>
          </select>
        </label>
      </div>

      {/* Cards grid */}
      {visibleClusters.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-on-surface-muted">
          No clusters match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleClusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  );
}
