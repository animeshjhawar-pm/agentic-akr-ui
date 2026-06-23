'use client';

/**
 * TreeEventLog
 *
 * Groups RunEvents into a hierarchical tree of phases:
 *   - Planner
 *   - Generation (sub-grouped per resourceId)
 *   - Selection
 *   - Geo
 *   - Result
 *
 * Each phase node is collapsible. Leaf nodes show ExpandedDetail.
 * Filtered by selectedStage when set.
 */

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { RunEvent } from '@/lib/events';
import { ExpandedDetail, stageBadgeClass } from './EventLog';

// ---------------------------------------------------------------------------
// Phase definitions
// ---------------------------------------------------------------------------

type PhaseName = 'Planner' | 'Generation' | 'Selection' | 'Geo' | 'Result';

/** Map each event stage to its top-level phase */
function stageToPhase(stage: string): PhaseName {
  switch (stage) {
    case 'planner':
      return 'Planner';
    case 'seed-gen':
    case 'angle-derivation':
    case 'broad-match':
    case 'lane':
    case 'name-expansion':
    case 'mine-serp':
    case 'pre-gate':
    case 'grade':
      return 'Generation';
    case 'cluster':
    case 'score':
    case 'select':
      return 'Selection';
    case 'geo':
      return 'Geo';
    case 'run':
      return 'Result';
    default:
      return 'Generation';
  }
}

/** Display name for the selectedStage filter to phase mapping */
const STAGE_FILTER_TO_PHASE: Record<string, PhaseName> = {
  planner: 'Planner',
  'seed-gen': 'Generation',
  'angle-derivation': 'Generation',
  'broad-match': 'Generation',
  lane: 'Generation',
  'name-expansion': 'Generation',
  'mine-serp': 'Generation',
  'pre-gate': 'Generation',
  grade: 'Generation',
  cluster: 'Selection',
  score: 'Selection',
  select: 'Selection',
  geo: 'Geo',
  result: 'Result',
  run: 'Result',
};

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

function eventTypeLabel(evt: RunEvent): string {
  const type = 'type' in evt ? (evt as { type?: string }).type : undefined;
  return type ? `${evt.stage}/${type}` : evt.stage;
}

// ---------------------------------------------------------------------------
// LeafNode - a single event row, expandable to show ExpandedDetail
// ---------------------------------------------------------------------------

interface LeafNodeProps {
  evt: RunEvent;
  depth: number;
}

function LeafNode({ evt, depth }: LeafNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const paddingLeft = depth * 16 + 8;

  return (
    <div className="border-b border-border last:border-0">
      <div
        className="flex items-start gap-2 py-1.5 text-xs hover:bg-surface-muted"
        style={{ paddingLeft }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse event details' : 'Expand event details'}
          onClick={toggle}
          className="flex-shrink-0 mt-0.5 text-on-surface-muted hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
        >
          {expanded ? (
            <ChevronDown size={11} aria-hidden="true" />
          ) : (
            <ChevronRight size={11} aria-hidden="true" />
          )}
        </button>
        <span className="font-mono tabular-nums text-on-surface-muted flex-shrink-0 w-[54px] text-[10px]">
          {formatTs(evt.ts)}
        </span>
        <span
          className={`flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${stageBadgeClass(evt.stage)}`}
        >
          {eventTypeLabel(evt)}
        </span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: paddingLeft + 20 }} className="pb-2 pr-3">
          <ExpandedDetail evt={evt} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResourceGroup - sub-group within Generation phase, one per resourceId
// ---------------------------------------------------------------------------

interface ResourceGroupProps {
  resourceId: string;
  events: RunEvent[];
  depth: number;
}

function ResourceGroup({ resourceId, events, depth }: ResourceGroupProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const paddingLeft = depth * 16 + 8;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 text-[11px] text-on-surface-muted hover:bg-surface-muted"
        style={{ paddingLeft }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Collapse resource ${resourceId}` : `Expand resource ${resourceId}`}
          onClick={toggle}
          className="flex-shrink-0 text-on-surface-muted hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
        >
          {open ? (
            <ChevronDown size={11} aria-hidden="true" />
          ) : (
            <ChevronRight size={11} aria-hidden="true" />
          )}
        </button>
        <span className="font-mono text-on-surface">{resourceId}</span>
        <span className="text-on-surface-muted text-[10px]">({events.length})</span>
      </div>
      {open && (
        <div>
          {events.map((evt, idx) => (
            <LeafNode key={`${evt.ts}-${evt.stage}-${idx}`} evt={evt} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhaseNode - top-level collapsible phase
// ---------------------------------------------------------------------------

interface PhaseNodeProps {
  name: PhaseName;
  events: RunEvent[];
}

function PhaseNode({ name, events }: PhaseNodeProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const isGeneration = name === 'Generation';

  // For Generation phase: group by resourceId
  const resourceGroups: Map<string, RunEvent[]> = new Map();
  if (isGeneration) {
    for (const evt of events) {
      const rid = 'resourceId' in evt ? (evt as { resourceId?: string }).resourceId ?? '__unknown__' : '__unknown__';
      if (!resourceGroups.has(rid)) {
        resourceGroups.set(rid, []);
      }
      resourceGroups.get(rid)!.push(evt);
    }
  }

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium hover:bg-surface-muted">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Collapse ${name} phase` : `Expand ${name} phase`}
          onClick={toggle}
          className="flex-shrink-0 text-on-surface-muted hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
        >
          {open ? (
            <ChevronDown size={13} aria-hidden="true" />
          ) : (
            <ChevronRight size={13} aria-hidden="true" />
          )}
        </button>
        <span className="text-on-surface">{name}</span>
        <span className="text-on-surface-muted text-[10px] font-normal">({events.length})</span>
      </div>
      {open && (
        <div>
          {isGeneration
            ? Array.from(resourceGroups.entries()).map(([rid, evts]) => (
                <ResourceGroup key={rid} resourceId={rid} events={evts} depth={1} />
              ))
            : events.map((evt, idx) => (
                <LeafNode key={`${evt.ts}-${evt.stage}-${idx}`} evt={evt} depth={1} />
              ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeEventLog
// ---------------------------------------------------------------------------

interface TreeEventLogProps {
  log: RunEvent[];
  selectedStage: string | null;
}

export default function TreeEventLog({ log, selectedStage }: TreeEventLogProps) {
  // Filter by selectedStage
  const filtered = selectedStage
    ? log.filter((evt) => {
        const phase = stageToPhase(evt.stage);
        const filterPhase = STAGE_FILTER_TO_PHASE[selectedStage];
        if (!filterPhase) return false;
        if (phase !== filterPhase) return false;
        // For non-Generation phases, the filter applies directly.
        // For Generation phase, also match the stage itself when a specific stage is given.
        if (filterPhase === 'Generation') {
          return evt.stage === selectedStage;
        }
        return true;
      })
    : log;

  if (filtered.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-32 text-sm text-on-surface-muted"
        role="status"
        aria-live="polite"
      >
        No events
      </div>
    );
  }

  // Group events into phases, preserving order
  const PHASE_ORDER: PhaseName[] = ['Planner', 'Generation', 'Selection', 'Geo', 'Result'];
  const phaseMap = new Map<PhaseName, RunEvent[]>();
  for (const phase of PHASE_ORDER) {
    phaseMap.set(phase, []);
  }
  for (const evt of filtered) {
    const phase = stageToPhase(evt.stage);
    phaseMap.get(phase)!.push(evt);
  }

  // Render only phases that have events
  const activePhases = PHASE_ORDER.filter((p) => (phaseMap.get(p)?.length ?? 0) > 0);

  return (
    <div
      className="overflow-auto rounded-b-lg min-h-[60vh] max-h-[82vh]"
      aria-label="Pipeline event tree"
    >
      {activePhases.map((phase) => (
        <PhaseNode key={phase} name={phase} events={phaseMap.get(phase)!} />
      ))}
    </div>
  );
}
