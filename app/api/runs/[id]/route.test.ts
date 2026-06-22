// app/api/runs/[id]/route.test.ts
//
// Tests for GET /api/runs/:id?since=<seq>
// Verifies: events-since query is honored, maxSeq is correct, status is threaded.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunEvent } from '@/lib/events';
import type { RunEventRow, RunRow } from '@/lib/store/runs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetRunEventsSince = vi.fn<[unknown, string, number], Promise<RunEventRow[]>>();
const mockGetRun = vi.fn<[unknown, string], Promise<RunRow | null>>();
const mockGetRunStorePool = vi.fn(() => ({}));

vi.mock('@/lib/store/runs', () => ({
  getRunEventsSince: (...args: Parameters<typeof mockGetRunEventsSince>) =>
    mockGetRunEventsSince(...args),
  getRun: (...args: Parameters<typeof mockGetRun>) => mockGetRun(...args),
}));

vi.mock('@/lib/store/pg', () => ({
  getRunStorePool: () => mockGetRunStorePool(),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEventRow(seq: number): RunEventRow {
  return {
    seq,
    ts: 1000 + seq,
    event: {
      ts: 1000 + seq,
      stage: 'planner',
      type: 'decision',
      step: `step-${seq}`,
      rationale: `r${seq}`,
    } as RunEvent,
  };
}

function makeRunRow(status: string): RunRow {
  return {
    runId: 'run-1',
    clientId: 'client-1',
    status,
    spend: null,
    selected: null,
    clusters: null,
    startedAt: null,
    finishedAt: null,
  };
}

async function callRoute(path: string): Promise<Response> {
  const { GET } = await import('./route');
  const req = new Request(`http://localhost${path}`);
  const idMatch = path.match(/\/api\/runs\/([^/?]+)/);
  const id = idMatch ? idMatch[1] : 'run-1';
  return GET(req, { params: Promise.resolve({ id }) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/runs/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns events, maxSeq, and status for a running run', async () => {
    const rows = [makeEventRow(3), makeEventRow(5), makeEventRow(7)];
    mockGetRunEventsSince.mockResolvedValue(rows);
    mockGetRun.mockResolvedValue(makeRunRow('running'));

    const res = await callRoute('/api/runs/run-1?since=2');
    expect(res.status).toBe(200);

    const body = await res.json() as { runId: string; events: RunEvent[]; maxSeq: number; status: string };
    expect(body.runId).toBe('run-1');
    expect(body.events).toHaveLength(3);
    expect(body.maxSeq).toBe(7);
    expect(body.status).toBe('running');
  });

  it('passes the since param to getRunEventsSince', async () => {
    mockGetRunEventsSince.mockResolvedValue([]);
    mockGetRun.mockResolvedValue(makeRunRow('running'));

    await callRoute('/api/runs/run-1?since=42');

    expect(mockGetRunEventsSince).toHaveBeenCalledWith(expect.anything(), 'run-1', 42);
  });

  it('defaults since=0 when not provided', async () => {
    mockGetRunEventsSince.mockResolvedValue([]);
    mockGetRun.mockResolvedValue(makeRunRow('pending'));

    await callRoute('/api/runs/run-1');

    expect(mockGetRunEventsSince).toHaveBeenCalledWith(expect.anything(), 'run-1', 0);
  });

  it('returns maxSeq equal to since when no events returned', async () => {
    mockGetRunEventsSince.mockResolvedValue([]);
    mockGetRun.mockResolvedValue(makeRunRow('running'));

    const res = await callRoute('/api/runs/run-1?since=10');
    const body = await res.json() as { maxSeq: number };
    expect(body.maxSeq).toBe(10);
  });

  it('returns status=pending when run not found', async () => {
    mockGetRunEventsSince.mockResolvedValue([]);
    mockGetRun.mockResolvedValue(null);

    const res = await callRoute('/api/runs/run-missing');
    const body = await res.json() as { status: string };
    expect(body.status).toBe('pending');
  });

  it('returns status=complete for a complete run', async () => {
    mockGetRunEventsSince.mockResolvedValue([]);
    mockGetRun.mockResolvedValue(makeRunRow('complete'));

    const res = await callRoute('/api/runs/run-done');
    const body = await res.json() as { status: string };
    expect(body.status).toBe('complete');
  });
});
