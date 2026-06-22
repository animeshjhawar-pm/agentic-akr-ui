/**
 * lib/store/runs.test.ts
 *
 * Offline TDD tests for every function in runs.ts.
 * A fake pool whose .query() records calls and returns canned rows is injected;
 * no real DB connection is made.
 *
 * Assertions cover:
 *   - Correct table + columns referenced in the SQL text
 *   - Correct WHERE / ORDER BY clauses
 *   - camelCase mapping of snake_case DB columns
 *   - insertRunRequest embeds runInput inside params_json
 *   - getRunEventsSince uses `seq > $2` and returns parsed events in seq order
 */

import { describe, it, expect, vi } from 'vitest';
import {
  insertRunRequest,
  listRuns,
  getRun,
  getRunEventsSince,
  getRunClusters,
  getRunKeywords,
} from './runs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a fake pool whose .query() always resolves with the given rows. */
function makePool(rows: Record<string, unknown>[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

// ---------------------------------------------------------------------------
// insertRunRequest
// ---------------------------------------------------------------------------

describe('insertRunRequest', () => {
  it('inserts into run_requests with correct columns', async () => {
    const pool = makePool([{ id: 'req-1' }]);
    const id = await insertRunRequest(pool, {
      id: 'req-1',
      clientId: 'cli-1',
      resourceIds: ['page-a', 'page-b'],
      runInput: { url: 'https://example.com' },
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO run_requests/);
    expect(sql).toMatch(/id/);
    expect(sql).toMatch(/client_id/);
    expect(sql).toMatch(/resource_ids/);
    expect(sql).toMatch(/params_json/);
    expect(sql).toMatch(/status/);
    expect(sql).toMatch(/RETURNING id/i);
    expect(id).toBe('req-1');

    // params[0] = id, [1] = clientId, [2] = resourceIds, [3] = params_json string, [4] = 'pending'
    expect(params[0]).toBe('req-1');
    expect(params[1]).toBe('cli-1');
    expect(params[2]).toEqual(['page-a', 'page-b']);
    expect(params[4]).toBe('pending');
  });

  it('embeds runInput inside params_json', async () => {
    const pool = makePool([{ id: 'req-2' }]);
    const runInput = { url: 'https://example.com', mode: 'full' };
    await insertRunRequest(pool, {
      id: 'req-2',
      clientId: 'cli-1',
      resourceIds: [],
      runInput,
      params: { extra: 'yes' },
    });

    const [, params] = pool.query.mock.calls[0];
    const paramsJson = JSON.parse(params[3] as string);
    expect(paramsJson.runInput).toEqual(runInput);
    expect(paramsJson.extra).toBe('yes');
  });

  it('uses empty object for params when not provided', async () => {
    const pool = makePool([{ id: 'req-3' }]);
    await insertRunRequest(pool, {
      id: 'req-3',
      clientId: 'cli-1',
      resourceIds: [],
      runInput: { url: 'https://x.com' },
    });

    const [, params] = pool.query.mock.calls[0];
    const paramsJson = JSON.parse(params[3] as string);
    // Only runInput key -- no extra cruft
    expect(Object.keys(paramsJson)).toEqual(['runInput']);
  });

  it('does not interpolate values into the SQL string', async () => {
    const pool = makePool([{ id: 'req-4' }]);
    await insertRunRequest(pool, {
      id: 'req-4',
      clientId: 'evil\'; DROP TABLE run_requests;--',
      resourceIds: [],
      runInput: {},
    });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/evil/);
  });
});

// ---------------------------------------------------------------------------
// listRuns
// ---------------------------------------------------------------------------

describe('listRuns', () => {
  const dbRows: Record<string, unknown>[] = [
    {
      run_id: 'run-1',
      client_id: 'cli-1',
      status: 'done',
      spend: 0.42,
      selected: 10,
      clusters: 3,
      started_at: '2024-01-01T00:00:00Z',
      finished_at: '2024-01-01T01:00:00Z',
    },
    {
      run_id: 'run-2',
      client_id: 'cli-2',
      status: 'running',
      spend: null,
      selected: null,
      clusters: null,
      started_at: null,
      finished_at: null,
    },
  ];

  it('queries the correct columns and ORDER BY', async () => {
    const pool = makePool(dbRows);
    await listRuns(pool);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM runs/);
    expect(sql).toMatch(/run_id/);
    expect(sql).toMatch(/client_id/);
    expect(sql).toMatch(/status/);
    expect(sql).toMatch(/spend/);
    expect(sql).toMatch(/selected/);
    expect(sql).toMatch(/clusters/);
    expect(sql).toMatch(/started_at/);
    expect(sql).toMatch(/finished_at/);
    expect(sql).toMatch(/ORDER BY started_at DESC NULLS LAST/);
  });

  it('maps snake_case columns to camelCase', async () => {
    const pool = makePool(dbRows);
    const rows = await listRuns(pool);
    expect(rows[0]).toMatchObject({
      runId: 'run-1',
      clientId: 'cli-1',
      status: 'done',
      spend: 0.42,
      selected: 10,
      clusters: 3,
    });
    expect(rows[0].startedAt).toBeInstanceOf(Date);
    expect(rows[0].finishedAt).toBeInstanceOf(Date);
  });

  it('maps null temporal columns to null', async () => {
    const pool = makePool(dbRows);
    const rows = await listRuns(pool);
    expect(rows[1].startedAt).toBeNull();
    expect(rows[1].finishedAt).toBeNull();
    expect(rows[1].spend).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRun
// ---------------------------------------------------------------------------

describe('getRun', () => {
  it('returns null when no row found', async () => {
    const pool = makePool([]);
    const result = await getRun(pool, 'missing');
    expect(result).toBeNull();
  });

  it('passes runId as $1 and maps the row', async () => {
    const pool = makePool([
      {
        run_id: 'run-1',
        client_id: 'cli-1',
        status: 'done',
        spend: 1.5,
        selected: 5,
        clusters: 2,
        started_at: '2024-06-01T10:00:00Z',
        finished_at: '2024-06-01T11:00:00Z',
      },
    ]);
    const result = await getRun(pool, 'run-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE run_id=\$1/);
    expect(params).toEqual(['run-1']);
    expect(result?.runId).toBe('run-1');
    expect(result?.status).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// getRunEventsSince
// ---------------------------------------------------------------------------

describe('getRunEventsSince', () => {
  const dbRows: Record<string, unknown>[] = [
    { seq: 2, ts: 1000, event_json: { ts: 1000, stage: 'run', type: 'complete', pages: 1, selected: 5, spend: 0.1 } },
    { seq: 3, ts: 2000, event_json: { ts: 2000, stage: 'run', type: 'complete', pages: 2, selected: 8, spend: 0.2 } },
  ];

  it('queries run_events with seq > $2 and ORDER BY seq ASC', async () => {
    const pool = makePool(dbRows);
    await getRunEventsSince(pool, 'run-1', 1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM run_events/);
    expect(sql).toMatch(/WHERE run_id=\$1 AND seq > \$2/);
    expect(sql).toMatch(/ORDER BY seq ASC/);
    expect(params).toEqual(['run-1', 1]);
  });

  it('defaults sinceSeq to 0', async () => {
    const pool = makePool(dbRows);
    await getRunEventsSince(pool, 'run-1');
    const [, params] = pool.query.mock.calls[0];
    expect(params[1]).toBe(0);
  });

  it('returns rows with parsed event_json as event, in seq order', async () => {
    const pool = makePool(dbRows);
    const rows = await getRunEventsSince(pool, 'run-1', 1);
    expect(rows).toHaveLength(2);
    expect(rows[0].seq).toBe(2);
    expect(rows[0].ts).toBe(1000);
    expect(rows[0].event).toMatchObject({ stage: 'run', type: 'complete', pages: 1 });
    expect(rows[1].seq).toBe(3);
    expect(rows[1].event).toMatchObject({ stage: 'run', type: 'complete', pages: 2 });
  });

  it('parses event_json when stored as a JSON string', async () => {
    const event = { ts: 500, stage: 'run', type: 'complete', pages: 0, selected: 0, spend: 0 };
    const pool = makePool([{ seq: 1, ts: 500, event_json: JSON.stringify(event) }]);
    const rows = await getRunEventsSince(pool, 'run-1', 0);
    expect(rows[0].event).toMatchObject(event);
  });

  it('returns an empty array when no events match', async () => {
    const pool = makePool([]);
    const rows = await getRunEventsSince(pool, 'run-1', 999);
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getRunClusters
// ---------------------------------------------------------------------------

describe('getRunClusters', () => {
  it('returns null when no row found', async () => {
    const pool = makePool([]);
    const result = await getRunClusters(pool, 'run-missing');
    expect(result).toBeNull();
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM run_clusters/);
    expect(params).toEqual(['run-missing']);
  });

  it('returns the parsed clusters_json object', async () => {
    const payload = { clusters: [{ id: 'c1', terms: ['a', 'b'] }], meta: { total: 1 } };
    const pool = makePool([{ clusters_json: payload }]);
    const result = await getRunClusters(pool, 'run-1');
    expect(result).toEqual(payload);
  });

  it('handles clusters_json stored as a JSON string', async () => {
    const payload = { clusters: [], meta: {} };
    const pool = makePool([{ clusters_json: JSON.stringify(payload) }]);
    const result = await getRunClusters(pool, 'run-1');
    expect(result).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// getRunKeywords
// ---------------------------------------------------------------------------

describe('getRunKeywords', () => {
  const dbRows: Record<string, unknown>[] = [
    { term: 'seo tools', volume: 1200, kd: 45, score: 0.9, intent: 'commercial', source: 'serp' },
    { term: 'free seo', volume: null, kd: null, score: null, intent: null, source: null },
  ];

  it('queries run_keywords with ORDER BY score DESC NULLS LAST', async () => {
    const pool = makePool(dbRows);
    await getRunKeywords(pool, 'run-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM run_keywords/);
    expect(sql).toMatch(/WHERE run_id=\$1/);
    expect(sql).toMatch(/ORDER BY score DESC NULLS LAST/);
    expect(params).toEqual(['run-1']);
  });

  it('maps rows to the expected shape', async () => {
    const pool = makePool(dbRows);
    const rows = await getRunKeywords(pool, 'run-1');
    expect(rows[0]).toEqual({
      term: 'seo tools',
      volume: 1200,
      kd: 45,
      score: 0.9,
      intent: 'commercial',
      source: 'serp',
    });
  });

  it('maps null numeric/string fields to null', async () => {
    const pool = makePool(dbRows);
    const rows = await getRunKeywords(pool, 'run-1');
    expect(rows[1]).toEqual({
      term: 'free seo',
      volume: null,
      kd: null,
      score: null,
      intent: null,
      source: null,
    });
  });

  it('returns an empty array when no keywords exist', async () => {
    const pool = makePool([]);
    const rows = await getRunKeywords(pool, 'run-1');
    expect(rows).toHaveLength(0);
  });
});
