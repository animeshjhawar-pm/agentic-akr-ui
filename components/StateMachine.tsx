'use client';

/**
 * StateMachine
 *
 * Renders the pipeline stage graph as a horizontal node flow.
 * Each node shows: stage name, status (icon + text), and key counts.
 * Clicking a node sets the filter for the EventLog.
 *
 * Topology: planner -> seed-gen -> angle-derivation -> broad-match -> lane -> name-expansion -> mine-serp -> grade -> cluster -> score -> select -> result
 */

import React from 'react';
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import type { StageStatus, StageState } from '@/lib/runReducer';
import { STAGE_KEYS } from '@/lib/runReducer';
import type { RunReducerState } from '@/lib/runReducer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  planner: 'Planner',
  'seed-gen': 'Seed Gen',
  'angle-derivation': 'Angles',
  'broad-match': 'Broad Match',
  lane: 'Lane Agent',
  'name-expansion': 'Name Exp.',
  'mine-serp': 'Mine SERP',
  grade: 'Grade',
  cluster: 'Cluster',
  score: 'Score',
  select: 'Select',
  result: 'Result',
};

const COUNT_LABELS: Record<string, Record<string, string>> = {
  planner: { steps: 'steps' },
  'seed-gen': { count: 'seeds' },
  'angle-derivation': { count: 'angles' },
  'broad-match': { produced: 'produced', refeds: 'refed' },
  lane: { steps: 'steps' },
  'name-expansion': { variants: 'variants' },
  'mine-serp': { serperQueries: 'queries', competitorDomains: 'domains', rankedTermsPulled: 'terms', trendsPatterns: 'trends' },
  grade: { kept: 'kept', rejected: 'rej', graded: 'graded' },
  cluster: { count: 'clusters' },
  score: { count: 'scored' },
  select: { count: 'selected' },
  result: { selected: 'selected', pages: 'pages' },
};

function StatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'pending':
      return <Clock size={14} aria-hidden="true" className="text-on-surface-muted" />;
    case 'active':
      return (
        <Loader2
          size={14}
          aria-hidden="true"
          className="text-primary motion-safe:animate-spin"
        />
      );
    case 'done':
      return <CheckCircle2 size={14} aria-hidden="true" className="text-success" />;
    case 'error':
      return <XCircle size={14} aria-hidden="true" className="text-danger" />;
  }
}

function statusLabel(status: StageStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'active': return 'Running';
    case 'done': return 'Done';
    case 'error': return 'Error';
  }
}

function nodeRingClass(status: StageStatus, selected: boolean): string {
  const base = 'rounded-xl border-2 p-3 flex flex-col gap-1.5 cursor-pointer motion-safe:transition-all motion-safe:duration-200 min-w-[90px] max-w-[110px]';
  const ring = selected ? 'ring-2 ring-primary ring-offset-1' : '';
  switch (status) {
    case 'pending':
      return `${base} border-border bg-surface ${ring}`;
    case 'active':
      return `${base} border-primary bg-surface-elevated motion-safe:animate-pulse ${ring}`;
    case 'done':
      return `${base} border-success bg-success-surface ${ring}`;
    case 'error':
      return `${base} border-danger bg-danger-surface ${ring}`;
  }
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

interface NodeProps {
  stageKey: string;
  stageState: StageState;
  selected: boolean;
  onClick: (stage: string) => void;
}

function StageNode({ stageKey, stageState, selected, onClick }: NodeProps) {
  const { status, counts, lastTool } = stageState;
  const label = STAGE_LABELS[stageKey] ?? stageKey;
  const countKeys = COUNT_LABELS[stageKey] ?? {};
  const relevantCounts = Object.entries(countKeys).filter(([k]) => (counts[k] ?? 0) > 0);

  return (
    <button
      type="button"
      role="button"
      aria-label={`${label} stage: ${statusLabel(status)}${selected ? ', filtered' : ''}`}
      aria-pressed={selected}
      onClick={() => onClick(stageKey)}
      className={nodeRingClass(status, selected)}
    >
      {/* Header row */}
      <div className="flex items-center gap-1">
        <StatusIcon status={status} />
        <span className="text-xs font-semibold text-on-surface truncate">{label}</span>
      </div>

      {/* Status text (never color-only) */}
      <span
        className={[
          'text-[11px]',
          status === 'pending' && 'text-on-surface-muted',
          status === 'active' && 'text-primary',
          status === 'done' && 'text-success',
          status === 'error' && 'text-danger',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {statusLabel(status)}
      </span>

      {/* Counts */}
      {relevantCounts.length > 0 && (
        <dl className="flex flex-col gap-0.5 mt-1">
          {relevantCounts.map(([k, lbl]) => (
            <div key={k} className="flex items-center gap-1">
              <dt className="text-xs text-on-surface-muted">{lbl}</dt>
              <dd className="text-xs tabular-nums font-mono text-on-surface ml-auto">
                {counts[k] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Lane: show last tool name */}
      {stageKey === 'lane' && lastTool && (
        <span className="text-[10px] text-on-surface-muted truncate mt-0.5" title={lastTool}>
          {lastTool}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// StateMachine
// ---------------------------------------------------------------------------

interface StateMachineProps {
  stages: RunReducerState['stages'];
  selectedStage: string | null;
  onSelectStage: (stage: string | null) => void;
}

export default function StateMachine({
  stages,
  selectedStage,
  onSelectStage,
}: StateMachineProps) {
  function handleNodeClick(stage: string) {
    onSelectStage(selectedStage === stage ? null : stage);
  }

  return (
    <div role="region" aria-label="Pipeline stage diagram" className="w-full overflow-x-auto pb-2">
      <div className="flex items-start gap-2 min-w-max">
        {STAGE_KEYS.map((key, idx) => {
          const stageState = stages[key] ?? { status: 'pending' as StageStatus, counts: {} };
          return (
            <React.Fragment key={key}>
              <StageNode
                stageKey={key}
                stageState={stageState}
                selected={selectedStage === key}
                onClick={handleNodeClick}
              />
              {idx < STAGE_KEYS.length - 1 && (
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="text-on-surface-muted self-center flex-shrink-0 mt-2"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
