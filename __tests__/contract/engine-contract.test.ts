/**
 * __tests__/contract/engine-contract.test.ts
 *
 * End-to-end contract test -- no live DB, no imports from agentic-akr.
 *
 * Purpose: lock the UI store layer (lib/store/runs.ts) to the exact column
 * names the engine writes in its schema.sql. A future column rename on either
 * side should fail a test here instead of silently breaking the live
 * integration.
 *
 * Engine schema (authoritative):
 *   run_requests(id, client_id, resource_ids TEXT[], params_json JSONB,
 *                status, created_at, claimed_at)
 *   runs(run_id, request_id, client_id, status, spend, selected, clusters,
 *        started_at, finished_at)
 *   run_events(run_id, seq, ts, event_json JSONB, PK run_id+seq)
 *   run_clusters(run_id, clusters_json JSONB, created_at)
 *   run_keywords(run_id, term, volume, kd, score, intent, source)
 */

import { describe, it, expect, vi } from 'vitest';

import {
  insertRunRequest,
  listRuns,
  getRun,
  getRunEventsSince,
  getRunClusters,
  getRunKeywords,
} from '../../lib/store/runs';
import type { RunEvent, RunCompleteEvent, LaneAgentStepEvent } from '../../lib/events';
import { applyEvents, makeInitialState } from '../../lib/runReducer';

// ---------------------------------------------------------------------------
// EXPECTED column contract -- update HERE when the engine schema changes
// ---------------------------------------------------------------------------
const EXPECTED = {
  run_requests: ['id', 'client_id', 'resource_ids', 'params_json', 'status'],
  runs: ['run_id', 'client_id', 'status', 'spend', 'selected', 'clusters', 'started_at', 'finished_at'],
  run_events: ['seq', 'ts', 'event_json'],
  run_clusters: ['clusters_json'],
  run_keywords: ['term', 'volume', 'kd', 'score', 'intent', 'source'],
} as const;

// ---------------------------------------------------------------------------
// Fake pool factory
// ---------------------------------------------------------------------------
type FakeRows = Record<string, unknown>[];

function makeFakePool(rows: FakeRows = []) {
  const calls: { text: string; params: unknown[] }[] = [];
  const pool = {
    calls,
    query: vi.fn(async (text: string, params?: unknown[]) => {
      calls.push({ text, params: params ?? [] });
      // For INSERT ... RETURNING id, return the first param as id
      if (text.includes('RETURNING id')) {
        return { rows: [{ id: (params ?? [])[0] }] };
      }
      return { rows };
    }),
  };
  return pool;
}

// ---------------------------------------------------------------------------
// 1. INSERT CONTRACT -- run_requests
// ---------------------------------------------------------------------------
describe('insert contract: insertRunRequest', () => {
  it('targets run_requests and binds id, client_id, resource_ids, params_json, status', async () => {
    const pool = makeFakePool();
    const id = 'req-001';
    const clientId = 'client-abc';
    const resourceIds = ['res-1', 'res-2'];
    const runInput = { urls: ['https://example.com'], maxKeywords: 200 };

    await insertRunRequest(pool, { id, clientId, resourceIds, runInput });

    expect(pool.calls).toHaveLength(1);
    const { text, params } = pool.calls[0]!;

    // Table name
    expect(text).toContain('run_requests');

    // All required columns appear in the INSERT
    for (const col of EXPECTED.run_requests) {
      expect(text).toContain(col);
    }

    // Binding order: $1=id, $2=client_id, $3=resource_ids, $4=params_json, $5=status
    expect(params[0]).toBe(id);
    expect(params[1]).toBe(clientId);
    expect(params[2]).toEqual(resourceIds);
    // params_json must be a JSON string or object containing runInput
    const parsed = typeof params[3] === 'string'
      ? JSON.parse(params[3] as string)
      : params[3];
    expect(parsed).toMatchObject({ runInput });
    expect(params[4]).toBe('queued');
  });

  it('wraps extra params alongside runInput in params_json', async () => {
    const pool = makeFakePool();
    await insertRunRequest(pool, {
      id: 'req-002',
      clientId: 'c',
      resourceIds: [],
      runInput: { urls: [] },
      params: { priority: 'high', retries: 3 },
    });
    const { params } = pool.calls[0]!;
    const parsed = typeof params[3] === 'string'
      ? JSON.parse(params[3] as string)
      : params[3];
    expect(parsed).toMatchObject({ runInput: { urls: [] }, priority: 'high', retries: 3 });
  });
});

// ---------------------------------------------------------------------------
// 2. READ CONTRACT -- column names in SQL text
// ---------------------------------------------------------------------------
describe('read contract: listRuns', () => {
  it('selects all required runs columns from runs table', async () => {
    const pool = makeFakePool([]);
    await listRuns(pool);
    const { text } = pool.calls[0]!;
    expect(text).toContain('runs');
    for (const col of EXPECTED.runs) {
      expect(text, `listRuns SQL should reference column "${col}"`).toContain(col);
    }
  });
});

describe('read contract: getRun', () => {
  it('selects all required runs columns with run_id=$1 filter', async () => {
    const pool = makeFakePool([]);
    await getRun(pool, 'run-xyz');
    const { text, params } = pool.calls[0]!;
    expect(text).toContain('runs');
    for (const col of EXPECTED.runs) {
      expect(text, `getRun SQL should reference column "${col}"`).toContain(col);
    }
    // WHERE clause uses run_id=$1
    expect(text).toContain('run_id');
    expect(params[0]).toBe('run-xyz');
  });
});

describe('read contract: getRunEventsSince', () => {
  it('selects seq, ts, event_json from run_events with seq > $2', async () => {
    const pool = makeFakePool([]);
    await getRunEventsSince(pool, 'run-abc', 5);
    const { text, params } = pool.calls[0]!;
    expect(text).toContain('run_events');
    for (const col of EXPECTED.run_events) {
      expect(text, `getRunEventsSince SQL should reference column "${col}"`).toContain(col);
    }
    // Must filter by run_id and seq > cursor
    expect(text).toContain('seq > $2');
    expect(params[0]).toBe('run-abc');
    expect(params[1]).toBe(5);
  });

  it('defaults sinceSeq to 0 when omitted', async () => {
    const pool = makeFakePool([]);
    await getRunEventsSince(pool, 'run-abc');
    const { params } = pool.calls[0]!;
    expect(params[1]).toBe(0);
  });
});

describe('read contract: getRunClusters', () => {
  it('selects clusters_json from run_clusters', async () => {
    const pool = makeFakePool([]);
    await getRunClusters(pool, 'run-abc');
    const { text, params } = pool.calls[0]!;
    expect(text).toContain('run_clusters');
    for (const col of EXPECTED.run_clusters) {
      expect(text, `getRunClusters SQL should reference column "${col}"`).toContain(col);
    }
    expect(params[0]).toBe('run-abc');
  });
});

describe('read contract: getRunKeywords', () => {
  it('selects term, volume, kd, score, intent, source from run_keywords', async () => {
    const pool = makeFakePool([]);
    await getRunKeywords(pool, 'run-abc');
    const { text, params } = pool.calls[0]!;
    expect(text).toContain('run_keywords');
    for (const col of EXPECTED.run_keywords) {
      expect(text, `getRunKeywords SQL should reference column "${col}"`).toContain(col);
    }
    expect(params[0]).toBe('run-abc');
  });
});

// ---------------------------------------------------------------------------
// 3. END-TO-END FOLD -- engine writes, UI reads and reducer consumes
// ---------------------------------------------------------------------------
describe('end-to-end fold: event_json shape matches reducer', () => {
  // Simulate the engine writing a realistic set of RunEvent objects into
  // run_events.event_json, then verify the UI's store layer and reducer can
  // consume them without error.

  const fakeEvents: RunEvent[] = [
    {
      ts: 1000,
      stage: 'planner',
      type: 'decision',
      step: 'choose-lanes',
      rationale: 'two resource IDs detected',
    },
    {
      ts: 1100,
      stage: 'lane',
      type: 'agent-step',
      resourceId: 'res-1',
      step: 1,
      tool: 'search',
      detail: 'searching broad terms',
    } as LaneAgentStepEvent,
    {
      ts: 1200,
      stage: 'grade',
      type: 'batch',
      resourceId: 'res-1',
      graded: 50,
      kept: 40,
      rejected: 8,
      outOfScope: 2,
      avgScore: 0.72,
      detail: 'graded batch 1',
    },
    {
      ts: 1300,
      stage: 'run',
      type: 'complete',
      pages: 3,
      selected: 120,
      spend: 0.45,
    } as RunCompleteEvent,
  ];

  it('getRunEventsSince maps event_json -> event field correctly', async () => {
    // Simulate DB rows as the engine would write them: event_json is the
    // serialised RunEvent. The pool returns rows with event_json as an object
    // (pg driver auto-parses JSONB) or a JSON string.
    const fakeRows = fakeEvents.map((evt, i) => ({
      seq: i + 1,
      ts: evt.ts,
      event_json: evt, // pg JSONB returns a parsed object
    }));

    const pool = makeFakePool(fakeRows);
    const rows = await getRunEventsSince(pool, 'run-001');

    // The route's `.map(e => e.event)` shape
    const events: RunEvent[] = rows.map((r) => r.event);

    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({ stage: 'planner', type: 'decision' });
    expect(events[3]).toMatchObject({ stage: 'run', type: 'complete', spend: 0.45 });
  });

  it('applyEvents folds the events without error and updates totals', async () => {
    const fakeRows = fakeEvents.map((evt, i) => ({
      seq: i + 1,
      ts: evt.ts,
      event_json: evt,
    }));

    const pool = makeFakePool(fakeRows);
    const rows = await getRunEventsSince(pool, 'run-001');
    const events: RunEvent[] = rows.map((r) => r.event);

    const initialState = makeInitialState();
    const finalState = applyEvents(initialState, events);

    // RunCompleteEvent should have updated totals
    expect(finalState.totals.spend).toBeCloseTo(0.45);
    expect(finalState.totals.selected).toBe(120);
    expect(finalState.totals.pages).toBe(3);

    // result stage should be done
    expect(finalState.stages['result']?.status).toBe('done');
    // planner stage should have been promoted to active
    expect(finalState.stages['planner']?.status).not.toBe('pending');
  });

  it('event_json as JSON string (non-JSONB driver) is also handled', async () => {
    const evt: RunCompleteEvent = {
      ts: 2000,
      stage: 'run',
      type: 'complete',
      pages: 1,
      selected: 10,
      spend: 0.1,
    };
    const fakeRows = [{ seq: 1, ts: 2000, event_json: JSON.stringify(evt) }];
    const pool = makeFakePool(fakeRows);
    const rows = await getRunEventsSince(pool, 'run-002');
    expect(rows[0]!.event).toMatchObject({ stage: 'run', type: 'complete', spend: 0.1 });
  });
});

// ---------------------------------------------------------------------------
// 4. END-TO-END FOLD -- clusters shape consumed by components
// ---------------------------------------------------------------------------
describe('end-to-end fold: clusters_json shape matches ClustersResult', () => {
  it('getRunClusters returns { clusters, meta } usable by components', async () => {
    const clustersPayload = {
      clusters: [
        { name: 'seo tools', keywords: ['semrush', 'ahrefs'], count: 2 },
        { name: 'content marketing', keywords: ['blog seo'], count: 1 },
      ],
      meta: { totalClusters: 2, totalKeywords: 3, method: 'kmeans' },
    };

    const fakeRows = [{ clusters_json: clustersPayload }];
    const pool = makeFakePool(fakeRows);
    const result = await getRunClusters(pool, 'run-001');

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.clusters)).toBe(true);
    expect(result!.clusters).toHaveLength(2);
    expect(result!.meta).toMatchObject({ totalClusters: 2, method: 'kmeans' });

    // Verify the shape is directly usable (no extra unwrapping needed)
    const firstCluster = result!.clusters[0] as Record<string, unknown>;
    expect(firstCluster).toHaveProperty('name');
    expect(firstCluster).toHaveProperty('keywords');
  });

  it('getRunClusters handles clusters_json as a JSON string', async () => {
    const clustersPayload = {
      clusters: [{ name: 'test', keywords: [], count: 0 }],
      meta: { totalClusters: 1 },
    };
    const fakeRows = [{ clusters_json: JSON.stringify(clustersPayload) }];
    const pool = makeFakePool(fakeRows);
    const result = await getRunClusters(pool, 'run-002');
    expect(result!.clusters).toHaveLength(1);
    expect(result!.meta).toMatchObject({ totalClusters: 1 });
  });

  it('getRunClusters returns null when no row exists', async () => {
    const pool = makeFakePool([]);
    const result = await getRunClusters(pool, 'run-missing');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. KEYWORDS SHAPE
// ---------------------------------------------------------------------------
describe('read contract: getRunKeywords returns correct shape', () => {
  it('maps all six columns to KeywordRow correctly', async () => {
    const fakeRows = [
      { term: 'seo audit', volume: 1200, kd: 45, score: 0.85, intent: 'informational', source: 'serp' },
      { term: 'keyword tool', volume: null, kd: null, score: null, intent: null, source: null },
    ];
    const pool = makeFakePool(fakeRows);
    const keywords = await getRunKeywords(pool, 'run-001');

    expect(keywords).toHaveLength(2);
    expect(keywords[0]).toMatchObject({
      term: 'seo audit',
      volume: 1200,
      kd: 45,
      score: 0.85,
      intent: 'informational',
      source: 'serp',
    });
    // Null values are preserved as null
    expect(keywords[1]).toMatchObject({
      term: 'keyword tool',
      volume: null,
      kd: null,
      score: null,
      intent: null,
      source: null,
    });
  });
});
