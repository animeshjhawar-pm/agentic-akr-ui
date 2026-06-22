'use client';

/**
 * RunConfig
 *
 * Run-configuration panel. Controlled fields with safe defaults.
 * POSTs to /api/runs and transitions to execution view via onRunStarted.
 */

import React, { useState } from 'react';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import Tooltip from './Tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KnobValues {
  absoluteCostCeiling: number;
  totalKeywordBudget: number;
  maxLoops: number;
  seedTarget: number;
  gradeBatchSize: number;
  targetPages: number;
}

interface RunConfigProps {
  clientId: string;
  selectedResourceIds: Set<string>;
  /** Pre-filled from clientDetail.profile.geo; user may override. */
  targetGeoDefault: string;
  /** Called once the SSE stream opens and we receive the run/start event. */
  onRunStarted: (runId: string, stream: ReadableStreamDefaultReader<Uint8Array>) => void;
  /** When true, all inputs and the Run button are disabled. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Safe defaults
// ---------------------------------------------------------------------------

const DEFAULTS: KnobValues = {
  absoluteCostCeiling: 3,
  totalKeywordBudget: 20,
  maxLoops: 1,
  seedTarget: 5,
  gradeBatchSize: 40,
  targetPages: 10,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RunConfig({
  clientId,
  selectedResourceIds,
  targetGeoDefault,
  onRunStarted,
  disabled = false,
}: RunConfigProps) {
  const [knobs, setKnobs] = useState<KnobValues>({ ...DEFAULTS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = clientId.length > 0 && selectedResourceIds.size >= 1 && !loading && !disabled;

  function handleKnobChange(field: keyof KnobValues, raw: string) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      setKnobs((prev) => ({ ...prev, [field]: n }));
    }
  }

  async function handleRun() {
    if (!canRun) return;
    setLoading(true);
    setError(null);

    const body = {
      clientId,
      resourceIds: [...selectedResourceIds],
      // targetPages (no. of pages) drives the budget cap and the keyword target
      // for the resume loop; it is a RunInput field, not a knob.
      targetPages: knobs.targetPages,
      knobs: {
        absoluteCostCeiling: knobs.absoluteCostCeiling,
        totalKeywordBudget: knobs.totalKeywordBudget,
        maxLoops: knobs.maxLoops,
        seedTarget: knobs.seedTarget,
        gradeBatchSize: knobs.gradeBatchSize,
        agentic: {
          seedTarget: knobs.seedTarget,
          maxPlannerSteps: 3,
          // Resource lanes run concurrently up to this cap (broad-match is still
          // provider-capped at 2 concurrent, but grade/seed/SERP parallelize).
          maxConcurrentAgents: 3,
        },
        maxResumeRounds: 0,
      },
    };

    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const msg = res.ok ? 'Empty response body' : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const reader = res.body.getReader();

      // Read the first frame to extract runId, then hand off to parent.
      let runId: string | null = null;
      const decoder = new TextDecoder();
      let buffer = '';

      while (runId === null) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6)) as { type: string; runId?: string };
              if (evt.runId) {
                runId = evt.runId;
                break;
              }
            } catch {
              // malformed frame -- skip
            }
          }
        }
      }

      if (!runId) {
        throw new Error('No runId received from server');
      }

      // Pass the already-open reader to the parent so it can continue consuming.
      onRunStarted(runId, reader);
      // Handoff complete: clear our local loading flag. The panel is NOT
      // unmounted in this layout, so the button must not stay stuck on
      // "Starting...". While the run is in flight the parent keeps the button
      // disabled via the `disabled` prop (runState === 'running'); when the run
      // completes the parent flips runState to 'done' and the button re-enables.
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-1">Run Configuration</h2>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Knobs grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* absoluteCostCeiling */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="knob-cost-ceiling"
              className="text-xs font-medium text-on-surface-muted"
            >
              Cost Ceiling ($)
            </label>
            <Tooltip description="Hard spend cap for the whole run across DataForSEO, Serper, and LLM calls. The pipeline stops requesting new work once this budget is exhausted." />
          </div>
          <input
            id="knob-cost-ceiling"
            type="number"
            min={0}
            step={1}
            value={knobs.absoluteCostCeiling}
            onChange={(e) => handleKnobChange('absoluteCostCeiling', e.target.value)}
            disabled={disabled || loading}
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Cost ceiling in dollars"
          />
        </div>

        {/* totalKeywordBudget */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="knob-keyword-budget"
              className="text-xs font-medium text-on-surface-muted"
            >
              Keyword Budget
            </label>
            <Tooltip description="Target number of keywords to discover and grade. Caps how many candidate keywords the run pursues before selecting the final set." />
          </div>
          <input
            id="knob-keyword-budget"
            type="number"
            min={1}
            step={1}
            value={knobs.totalKeywordBudget}
            onChange={(e) => handleKnobChange('totalKeywordBudget', e.target.value)}
            disabled={disabled || loading}
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Total keyword budget"
          />
        </div>

        {/* maxLoops */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="knob-max-loops"
              className="text-xs font-medium text-on-surface-muted"
            >
              Max Loops
            </label>
            <Tooltip description="Maximum generation loops per resource. Each loop re-feeds the best kept keywords as new seeds to expand further; more loops = broader discovery but more time and cost." />
          </div>
          <input
            id="knob-max-loops"
            type="number"
            min={1}
            step={1}
            value={knobs.maxLoops}
            onChange={(e) => handleKnobChange('maxLoops', e.target.value)}
            disabled={disabled || loading}
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Max loops"
          />
        </div>

        {/* seedTarget */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="knob-seed-target"
              className="text-xs font-medium text-on-surface-muted"
            >
              Seed Target
            </label>
            <Tooltip description="How many starting seed keywords to generate per resource before expansion. More seeds = wider initial coverage." />
          </div>
          <input
            id="knob-seed-target"
            type="number"
            min={1}
            step={1}
            value={knobs.seedTarget}
            onChange={(e) => handleKnobChange('seedTarget', e.target.value)}
            disabled={disabled || loading}
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Seed target"
          />
        </div>

        {/* gradeBatchSize */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="knob-grade-batch"
              className="text-xs font-medium text-on-surface-muted"
            >
              Grade Batch Size
            </label>
            <Tooltip description="How many keywords are scored per LLM grading call. Larger batches = fewer LLM round-trips (faster/cheaper) but each call does more work." />
          </div>
          <input
            id="knob-grade-batch"
            type="number"
            min={1}
            step={1}
            value={knobs.gradeBatchSize}
            onChange={(e) => handleKnobChange('gradeBatchSize', e.target.value)}
            disabled={disabled || loading}
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Grade batch size"
          />
        </div>

        {/* targetPages -- no. of pages */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="knob-target-pages"
              className="text-xs font-medium text-on-surface-muted"
            >
              No. of Pages
            </label>
            <Tooltip description="Target number of candidate pages (topic clusters). Drives the run budget cap (cost per page x pages) and the keyword target the resume loop aims for." />
          </div>
          <input
            id="knob-target-pages"
            type="number"
            min={1}
            step={1}
            value={knobs.targetPages}
            onChange={(e) => handleKnobChange('targetPages', e.target.value)}
            disabled={disabled || loading}
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Number of pages"
          />
        </div>

        {/* targetGeo -- read-only: derived from client profile, not user-editable */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-on-surface-muted">
              Target Geo
            </span>
            <Tooltip description="The geographic market used for keyword research. Derived from the client profile and cannot be changed here." />
          </div>
          <span
            className="rounded border border-border bg-surface-muted px-2 py-1.5 text-sm text-on-surface-muted italic"
            aria-label="Target geography (derived from client profile)"
          >
            {targetGeoDefault} (derived from client profile)
          </span>
        </div>
      </div>


      {/* Run button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={!canRun}
          aria-disabled={!canRun}
          className={[
            'inline-flex items-center gap-2 rounded-lg px-6 py-2.5 min-h-[44px] text-sm font-semibold motion-safe:transition-colors cursor-pointer',
            'bg-primary text-primary-fg hover:bg-primary-hover',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          ].join(' ')}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />
              Starting...
            </>
          ) : (
            <>
              <Play size={14} aria-hidden="true" />
              Run AKR
            </>
          )}
        </button>

        {selectedResourceIds.size === 0 && (
          <p className="text-xs text-on-surface-muted">
            Select at least one resource to enable.
          </p>
        )}
        {selectedResourceIds.size > 0 && (
          <p className="text-xs text-on-surface-muted">
            {selectedResourceIds.size} resource{selectedResourceIds.size !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>
    </div>
  );
}
