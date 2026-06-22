import { describe, it, expect } from 'vitest';
import { reduceEvents, applyEvents, makeInitialState } from './runReducer';
import type { RunEvent } from './events';

// Representative event sequence
const events: RunEvent[] = [
  // Planner decision
  { ts: 1, stage: 'planner', type: 'decision', step: '1', rationale: 'Start' },
  // seed-gen start + done
  { ts: 2, stage: 'seed-gen', type: 'start', resourceId: 'r1' },
  { ts: 3, stage: 'seed-gen', type: 'done', resourceId: 'r1', count: 5 },
  // angle-derivation done
  { ts: 4, stage: 'angle-derivation', type: 'done', resourceId: 'r1', count: 3 },
  // 2 broad-match expands
  { ts: 5, stage: 'broad-match', type: 'expand', resourceId: 'r1', seed: 'foo', produced: 20 },
  { ts: 6, stage: 'broad-match', type: 'expand', resourceId: 'r1', seed: 'bar', produced: 15 },
  // 2 grade batches (updated shape: avgScore instead of strong, plus detail)
  {
    ts: 7,
    stage: 'grade',
    type: 'batch',
    resourceId: 'r1',
    graded: 20,
    kept: 10,
    rejected: 7,
    outOfScope: 3,
    avgScore: 6.0,
    detail: 'batch 1',
  },
  {
    ts: 8,
    stage: 'grade',
    type: 'batch',
    resourceId: 'r1',
    graded: 15,
    kept: 8,
    rejected: 5,
    outOfScope: 2,
    avgScore: 8.0,
    detail: 'batch 2',
  },
  // cluster/score/select done
  { ts: 9, stage: 'cluster', type: 'done', count: 12 },
  { ts: 10, stage: 'score', type: 'done', count: 12 },
  { ts: 11, stage: 'select', type: 'done', count: 10 },
  // run complete
  { ts: 12, stage: 'run', type: 'complete', pages: 50, selected: 10, spend: 1.25 },
];

describe('reduceEvents', () => {
  const state = reduceEvents(events);

  it('accumulates broad-match produced', () => {
    expect(state.stages['broad-match']?.counts['produced']).toBe(35);
  });

  it('accumulates grade kept', () => {
    expect(state.stages['grade']?.counts['kept']).toBe(18);
  });

  it('accumulates grade rejected', () => {
    expect(state.stages['grade']?.counts['rejected']).toBe(12);
  });

  it('accumulates grade graded', () => {
    expect(state.stages['grade']?.counts['graded']).toBe(35);
  });

  it('computes running average of grade avgScore', () => {
    // batch1: avg=6.0, batch2: avg=8.0 -> running avg = (6+8)/2 = 7
    expect(state.stages['grade']?.counts['avgScore']).toBeCloseTo(7.0);
  });

  it('marks planner as done (promoted by run/complete)', () => {
    expect(state.stages['planner']?.status).toBe('done');
  });

  it('marks seed-gen as done', () => {
    expect(state.stages['seed-gen']?.status).toBe('done');
  });

  it('marks angle-derivation as done', () => {
    expect(state.stages['angle-derivation']?.status).toBe('done');
  });

  it('marks broad-match as done (promoted by run/complete)', () => {
    expect(state.stages['broad-match']?.status).toBe('done');
  });

  it('marks grade as done (promoted by run/complete)', () => {
    expect(state.stages['grade']?.status).toBe('done');
  });

  it('marks cluster as done', () => {
    expect(state.stages['cluster']?.status).toBe('done');
  });

  it('marks score as done', () => {
    expect(state.stages['score']?.status).toBe('done');
  });

  it('marks select as done', () => {
    expect(state.stages['select']?.status).toBe('done');
  });

  it('marks result as done', () => {
    expect(state.stages['result']?.status).toBe('done');
  });

  it('sets totals from run/complete', () => {
    expect(state.totals).toEqual({ spend: 1.25, selected: 10, pages: 50 });
  });

  it('returns all events in log', () => {
    expect(state.log).toHaveLength(events.length);
  });

  it('accumulates seed-gen count', () => {
    expect(state.stages['seed-gen']?.counts['count']).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// New event type tests
// ---------------------------------------------------------------------------

describe('reduceEvents -- new pipeline events', () => {
  it('lane agent-step accumulates steps and tracks lastTool', () => {
    const evts: RunEvent[] = [
      { ts: 1, stage: 'lane', type: 'agent-step', resourceId: 'r1', step: 0, tool: 'fetchSERP', detail: 'fetching serp' },
      { ts: 2, stage: 'lane', type: 'agent-step', resourceId: 'r1', step: 1, tool: 'rankKeywords', detail: 'ranking' },
    ];
    const s = reduceEvents(evts);
    expect(s.stages['lane']?.counts['steps']).toBe(2);
    expect(s.stages['lane']?.lastTool).toBe('rankKeywords');
    expect(s.stages['lane']?.status).toBe('active');
  });

  it('broad-match refeed accumulates refeds', () => {
    const evts: RunEvent[] = [
      { ts: 1, stage: 'broad-match', type: 'expand', resourceId: 'r1', seed: 'foo', produced: 10 },
      { ts: 2, stage: 'broad-match', type: 'refeed', resourceId: 'r1', refed: 5, detail: 'refeeding 5' },
      { ts: 3, stage: 'broad-match', type: 'refeed', resourceId: 'r1', refed: 3, detail: 'refeeding 3' },
    ];
    const s = reduceEvents(evts);
    expect(s.stages['broad-match']?.counts['produced']).toBe(10);
    expect(s.stages['broad-match']?.counts['refeds']).toBe(8);
  });

  it('name-expansion done accumulates variants', () => {
    const evts: RunEvent[] = [
      { ts: 1, stage: 'name-expansion', type: 'done', resourceId: 'r1', variants: 12, detail: 'expanded 12 variants' },
      { ts: 2, stage: 'name-expansion', type: 'done', resourceId: 'r1', variants: 8, detail: 'expanded 8 variants' },
    ];
    const s = reduceEvents(evts);
    expect(s.stages['name-expansion']?.counts['variants']).toBe(20);
    expect(s.stages['name-expansion']?.status).toBe('done');
  });

  it('mine-serp done accumulates all counts', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'mine-serp',
        type: 'done',
        resourceId: 'r1',
        serperQueries: 3,
        competitorDomains: 5,
        rankedKeywordPulls: 10,
        rankedTermsPulled: 200,
        trendsSpawned: 2,
        trendsPatterns: 4,
        detail: 'mine-serp complete',
      },
      {
        ts: 2,
        stage: 'mine-serp',
        type: 'done',
        resourceId: 'r2',
        serperQueries: 2,
        competitorDomains: 3,
        rankedKeywordPulls: 5,
        rankedTermsPulled: 100,
        trendsSpawned: 1,
        trendsPatterns: 2,
        detail: 'mine-serp complete 2',
      },
    ];
    const s = reduceEvents(evts);
    const c = s.stages['mine-serp']?.counts;
    expect(c?.['serperQueries']).toBe(5);
    expect(c?.['competitorDomains']).toBe(8);
    expect(c?.['rankedKeywordPulls']).toBe(15);
    expect(c?.['rankedTermsPulled']).toBe(300);
    expect(c?.['trendsSpawned']).toBe(3);
    expect(c?.['trendsPatterns']).toBe(6);
    expect(s.stages['mine-serp']?.status).toBe('done');
  });

  it('mine-serp/keyword increments keywordsAnalyzed and rankedPulls', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'mine-serp',
        type: 'keyword',
        resourceId: 'r1',
        keyword: 'best crm software',
        titlesSeen: 10,
        competitorDomains: 3,
        rankedPulled: true,
        detail: 'keyword analysed',
      },
      {
        ts: 2,
        stage: 'mine-serp',
        type: 'keyword',
        resourceId: 'r1',
        keyword: 'crm tools',
        titlesSeen: 8,
        competitorDomains: 2,
        rankedPulled: false,
        detail: 'keyword analysed',
      },
      {
        ts: 3,
        stage: 'mine-serp',
        type: 'keyword',
        resourceId: 'r1',
        keyword: 'top crm',
        titlesSeen: 6,
        competitorDomains: 1,
        rankedPulled: true,
        detail: 'keyword analysed',
      },
    ];
    const s = reduceEvents(evts);
    const c = s.stages['mine-serp']?.counts;
    expect(c?.['keywordsAnalyzed']).toBe(3);
    expect(c?.['rankedPulls']).toBe(2);
    expect(s.stages['mine-serp']?.status).toBe('active');
  });

  it('mine-serp/patterns triggered sets trendsTriggered=1 and patternsFound', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'mine-serp',
        type: 'patterns',
        resourceId: 'r1',
        triggered: true,
        modifiers: ['best', 'top', 'cheapest'],
        candidateTerms: ['crm', 'saas'],
        detail: 'patterns found',
      },
    ];
    const s = reduceEvents(evts);
    const c = s.stages['mine-serp']?.counts;
    expect(c?.['trendsTriggered']).toBe(1);
    expect(c?.['patternsFound']).toBe(5); // 3 modifiers + 2 candidateTerms
  });

  it('mine-serp/patterns not-triggered sets trendsTriggered=0 and patternsFound=0', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'mine-serp',
        type: 'patterns',
        resourceId: 'r1',
        triggered: false,
        modifiers: [],
        candidateTerms: [],
        detail: 'trends not triggered',
      },
    ];
    const s = reduceEvents(evts);
    const c = s.stages['mine-serp']?.counts;
    expect(c?.['trendsTriggered']).toBe(0);
    expect(c?.['patternsFound']).toBe(0);
  });

  it('geo/done sets stage done with correct counts', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'geo',
        type: 'done',
        resourceId: 'r1',
        heads: 4,
        cities: 12,
        combosTried: 48,
        kept: 15,
        detail: 'geo expansion complete',
      },
    ];
    const s = reduceEvents(evts);
    expect(s.stages['geo']?.status).toBe('done');
    const c = s.stages['geo']?.counts;
    expect(c?.['heads']).toBe(4);
    expect(c?.['cities']).toBe(12);
    expect(c?.['combosTried']).toBe(48);
    expect(c?.['kept']).toBe(15);
  });

  it('pre-gate/done sets stage done with kept and dropped counts', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'pre-gate',
        type: 'done',
        resourceId: 'r1',
        kept: 42,
        dropped: 8,
        detail: 'pre-gate filter complete',
      },
    ];
    const s = reduceEvents(evts);
    expect(s.stages['pre-gate']?.status).toBe('done');
    const c = s.stages['pre-gate']?.counts;
    expect(c?.['kept']).toBe(42);
    expect(c?.['dropped']).toBe(8);
  });

  it('grade keeps the _batchCount accumulator out of public counts', () => {
    const evts: RunEvent[] = [
      { ts: 1, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 5, rejected: 4, outOfScope: 1, avgScore: 6.0, detail: 'b1' },
      { ts: 2, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 6, rejected: 3, outOfScope: 1, avgScore: 8.0, detail: 'b2' },
    ];
    const s = reduceEvents(evts);
    const counts = s.stages['grade']?.counts ?? {};
    expect(counts['_batchCount']).toBeUndefined();
    expect('_batchCount' in counts).toBe(false);
    // Running average still computed correctly: (6 + 8) / 2 = 7
    expect(counts['avgScore']).toBeCloseTo(7.0);
  });

  it('grade guards avgScore against NaN so the running average is not poisoned', () => {
    const evts: RunEvent[] = [
      { ts: 1, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 5, rejected: 4, outOfScope: 1, avgScore: 6.0, detail: 'b1' },
      // Server sent a missing/NaN avgScore for this batch -- must be skipped.
      { ts: 2, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 6, rejected: 3, outOfScope: 1, avgScore: NaN, detail: 'b2' },
      { ts: 3, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 7, rejected: 2, outOfScope: 1, avgScore: 8.0, detail: 'b3' },
    ];
    const s = reduceEvents(evts);
    const counts = s.stages['grade']?.counts ?? {};
    // avgScore must remain finite and reflect only the two valid batches: (6+8)/2 = 7
    expect(Number.isFinite(counts['avgScore'])).toBe(true);
    expect(counts['avgScore']).toBeCloseTo(7.0);
    // Non-score counters still accumulate across all three batches.
    expect(counts['graded']).toBe(30);
    expect(counts['kept']).toBe(18);
  });

  it('applyEvents folds incrementally to the same result as reduceEvents', () => {
    const evts: RunEvent[] = [
      { ts: 1, stage: 'broad-match', type: 'expand', resourceId: 'r1', seed: 'a', produced: 10 },
      { ts: 2, stage: 'broad-match', type: 'expand', resourceId: 'r1', seed: 'b', produced: 5 },
      { ts: 3, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 5, rejected: 4, outOfScope: 1, avgScore: 6.0, detail: 'b1' },
      { ts: 4, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 6, rejected: 3, outOfScope: 1, avgScore: 8.0, detail: 'b2' },
    ];
    // Feed one event at a time (mimics live streaming) and compare to a
    // from-scratch reduction of the whole array.
    let incremental = makeInitialState();
    for (const e of evts) {
      incremental = applyEvents(incremental, [e]);
    }
    const batch = reduceEvents(evts);
    expect(incremental.stages['broad-match']?.counts['produced']).toBe(15);
    expect(incremental.stages['grade']?.counts['avgScore']).toBeCloseTo(7.0);
    expect(incremental.log).toHaveLength(evts.length);
    expect(incremental.stages['grade']?.counts).toEqual(batch.stages['grade']?.counts);
  });

  it('pre-gate/done accumulates kept and dropped across multiple events', () => {
    const evts: RunEvent[] = [
      {
        ts: 1,
        stage: 'pre-gate',
        type: 'done',
        resourceId: 'r1',
        kept: 30,
        dropped: 10,
        detail: 'first batch',
      },
      {
        ts: 2,
        stage: 'pre-gate',
        type: 'done',
        resourceId: 'r2',
        kept: 20,
        dropped: 5,
        detail: 'second batch',
      },
    ];
    const s = reduceEvents(evts);
    expect(s.stages['pre-gate']?.status).toBe('done');
    const c = s.stages['pre-gate']?.counts;
    expect(c?.['kept']).toBe(50);
    expect(c?.['dropped']).toBe(15);
  });
});
