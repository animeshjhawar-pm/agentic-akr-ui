/**
 * Pure reducer for pipeline RunEvents.
 * Takes an accumulated array of events and derives stage statuses, counts, and totals.
 *
 * Two entry points are provided:
 *   - reduceEvents(events): build full state from scratch (used for history replay).
 *   - applyEvents(prevState, newEvents): incremental fold that only processes the
 *     newly-arrived events, mutating a cloned copy of prevState. This keeps live
 *     streaming O(1) per event instead of replaying the whole array each time.
 */

import type { RunEvent } from './events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StageStatus = 'pending' | 'active' | 'done' | 'error';

export interface StageState {
  status: StageStatus;
  counts: Record<string, number>;
  lastTool?: string;
  /**
   * Private rolling-average accumulators kept OUT of the public `counts` map so
   * UI code (e.g. PipelineGrid countSummary) never reads or renders them.
   * Currently only used by the `grade` stage to maintain a batch count for the
   * running avgScore average.
   */
  _acc?: Record<string, number>;
}

export interface RunReducerState {
  stages: Record<string, StageState>;
  log: RunEvent[];
  totals: {
    spend: number;
    selected: number;
    pages: number;
  };
}

// All known stage keys in pipeline order
export const STAGE_KEYS = [
  'planner',
  'seed-gen',
  'angle-derivation',
  'broad-match',
  'lane',
  'name-expansion',
  'mine-serp',
  'geo',
  'pre-gate',
  'grade',
  'cluster',
  'score',
  'select',
  'result',
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function makeInitialState(): RunReducerState {
  const stages: Record<string, StageState> = {};
  for (const key of STAGE_KEYS) {
    stages[key] = { status: 'pending', counts: {} };
  }
  return {
    stages,
    log: [],
    totals: { spend: 0, selected: 0, pages: 0 },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addCount(
  counts: Record<string, number>,
  key: string,
  delta: number,
): Record<string, number> {
  return { ...counts, [key]: (counts[key] ?? 0) + delta };
}

// ---------------------------------------------------------------------------
// Single-event fold (mutates `state`)
// ---------------------------------------------------------------------------

/**
 * Apply one event to `state` in place. The caller owns cloning/copy semantics.
 * The log append and 500-cap are handled by the caller (applyEvents).
 */
function foldEvent(state: RunReducerState, evt: RunEvent): void {
  const { stage } = evt;

  // Map 'run' stage events to the 'result' display stage
  const displayStage: string = stage === 'run' ? 'result' : stage;

  const current = state.stages[displayStage] ?? { status: 'pending', counts: {} };

  switch (stage) {
    case 'planner': {
      // planner/decision -- mark active; track steps
      state.stages['planner'] = {
        status: 'active',
        counts: addCount(current.counts, 'steps', 1),
      };
      break;
    }

    case 'seed-gen':
    case 'angle-derivation': {
      if (evt.type === 'start') {
        state.stages[stage] = {
          status: 'active',
          counts: current.counts,
        };
      } else if (evt.type === 'done') {
        state.stages[stage] = {
          status: 'done',
          counts: evt.count != null
            ? addCount(current.counts, 'count', evt.count)
            : current.counts,
        };
      }
      break;
    }

    case 'broad-match': {
      if (evt.type === 'expand') {
        // accumulate produced from expand events
        state.stages['broad-match'] = {
          status: 'active',
          counts: addCount(current.counts, 'produced', evt.produced),
        };
      } else if (evt.type === 'refeed') {
        // accumulate refed count from refeed events
        state.stages['broad-match'] = {
          status: 'active',
          counts: addCount(current.counts, 'refeds', evt.refed),
        };
      }
      break;
    }

    case 'lane': {
      // agent-step: track step count and last tool used
      const prev = current.counts;
      const updated: Record<string, number> = {
        ...prev,
        steps: (prev['steps'] ?? 0) + 1,
      };
      state.stages['lane'] = {
        status: 'active',
        counts: updated,
        lastTool: evt.tool,
      };
      break;
    }

    case 'name-expansion': {
      if (evt.type === 'done') {
        state.stages['name-expansion'] = {
          status: 'done',
          counts: addCount(current.counts, 'variants', evt.variants),
        };
      } else {
        state.stages['name-expansion'] = {
          status: 'active',
          counts: current.counts,
        };
      }
      break;
    }

    case 'mine-serp': {
      if (evt.type === 'done') {
        const prev = current.counts;
        const updated: Record<string, number> = {
          ...prev,
          serperQueries: (prev['serperQueries'] ?? 0) + evt.serperQueries,
          competitorDomains: (prev['competitorDomains'] ?? 0) + evt.competitorDomains,
          rankedKeywordPulls: (prev['rankedKeywordPulls'] ?? 0) + evt.rankedKeywordPulls,
          rankedTermsPulled: (prev['rankedTermsPulled'] ?? 0) + evt.rankedTermsPulled,
          trendsSpawned: (prev['trendsSpawned'] ?? 0) + evt.trendsSpawned,
          trendsPatterns: (prev['trendsPatterns'] ?? 0) + evt.trendsPatterns,
        };
        state.stages['mine-serp'] = { status: 'done', counts: updated };
      } else if (evt.type === 'keyword') {
        const prev = current.counts;
        const updated: Record<string, number> = {
          ...prev,
          keywordsAnalyzed: (prev['keywordsAnalyzed'] ?? 0) + 1,
          rankedPulls: (prev['rankedPulls'] ?? 0) + (evt.rankedPulled ? 1 : 0),
        };
        state.stages['mine-serp'] = { status: 'active', counts: updated };
      } else if (evt.type === 'patterns') {
        const prev = current.counts;
        const updated: Record<string, number> = {
          ...prev,
          trendsTriggered: evt.triggered ? 1 : 0,
          patternsFound: evt.triggered
            ? evt.modifiers.length + evt.candidateTerms.length
            : 0,
        };
        state.stages['mine-serp'] = { status: 'active', counts: updated };
      }
      break;
    }

    case 'geo': {
      if (evt.type === 'done') {
        state.stages['geo'] = {
          status: 'done',
          counts: {
            heads: evt.heads,
            cities: evt.cities,
            combosTried: evt.combosTried,
            kept: evt.kept,
          },
        };
      }
      break;
    }

    case 'pre-gate': {
      if (evt.type === 'done') {
        state.stages['pre-gate'] = {
          status: 'done',
          counts: {
            kept: (current.counts['kept'] ?? 0) + evt.kept,
            dropped: (current.counts['dropped'] ?? 0) + evt.dropped,
          },
        };
      }
      break;
    }

    case 'grade': {
      const prev = current.counts;
      // Rolling-average accumulator lives in the private `_acc` map, never in
      // the displayed `counts`. Guard avgScore against NaN/Infinity so one bad
      // batch never poisons the running average permanently.
      const prevBatchCount = current._acc?.['batchCount'] ?? 0;
      const prevAvg = prev['avgScore'] ?? 0;

      const batchAvg = evt.avgScore;
      const validAvg = Number.isFinite(batchAvg);
      // Only count this batch toward the running average if its score is finite.
      const n = prevBatchCount + (validAvg ? 1 : 0);
      const newAvg = validAvg
        ? prevAvg + (batchAvg - prevAvg) / n
        : prevAvg;

      const updated: Record<string, number> = {
        ...prev,
        graded: (prev['graded'] ?? 0) + evt.graded,
        kept: (prev['kept'] ?? 0) + evt.kept,
        rejected: (prev['rejected'] ?? 0) + evt.rejected,
        outOfScope: (prev['outOfScope'] ?? 0) + evt.outOfScope,
        avgScore: newAvg,
      };
      state.stages['grade'] = {
        status: 'active',
        counts: updated,
        _acc: { ...(current._acc ?? {}), batchCount: n },
      };
      break;
    }

    case 'cluster':
    case 'score':
    case 'select': {
      state.stages[stage] = {
        status: 'done',
        counts: { count: evt.count },
      };
      break;
    }

    case 'run': {
      if (evt.type === 'complete') {
        state.totals = {
          spend: evt.spend,
          selected: evt.selected,
          pages: evt.pages,
        };
        // Mark result stage done; also mark upstream stages done if still active
        state.stages['result'] = {
          status: 'done',
          counts: {
            pages: evt.pages,
            selected: evt.selected,
          },
        };
        // Promote any 'active' stages that haven't explicitly finished to 'done'
        for (const key of STAGE_KEYS) {
          if (key === 'result') continue;
          if (state.stages[key]?.status === 'active') {
            state.stages[key] = { ...state.stages[key]!, status: 'done' };
          }
        }
      }
      break;
    }

    default:
      // Unknown stage -- still active
      if (state.stages[displayStage]) {
        state.stages[displayStage] = {
          ...state.stages[displayStage]!,
          status: 'active',
        };
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Incremental fold
// ---------------------------------------------------------------------------

/**
 * Apply only `newEvents` on top of `prevState`, returning a new state object.
 * O(newEvents.length) -- does NOT replay the full history. The log is appended
 * with push (O(1) amortised per event) rather than a spread-in-loop.
 *
 * The full log is retained here; the 500-event render cap is applied downstream
 * in EventLog/TreeEventLog (which still need the true total count to display
 * "Showing last 500 of N").
 */
export function applyEvents(
  prevState: RunReducerState,
  newEvents: RunEvent[],
): RunReducerState {
  if (newEvents.length === 0) return prevState;

  // Shallow clone the parts we mutate. Stage objects are replaced (not mutated)
  // by foldEvent, so a shallow copy of the stages map is sufficient.
  const next: RunReducerState = {
    stages: { ...prevState.stages },
    log: prevState.log.slice(),
    totals: prevState.totals,
  };

  for (const evt of newEvents) {
    next.log.push(evt);
    foldEvent(next, evt);
  }

  return next;
}

// ---------------------------------------------------------------------------
// Full reduce (replay from scratch)
// ---------------------------------------------------------------------------

export function reduceEvents(events: RunEvent[]): RunReducerState {
  return applyEvents(makeInitialState(), events);
}
