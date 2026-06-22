// app/api/runs/route.test.ts
//
// Strict offline TDD for POST /api/runs and GET /api/runs.
// All DB and store dependencies are vi.mock'd -- no live DB.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route handler.
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  getPool: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('@/lib/queries', () => ({
  getClientProfile: vi.fn(),
  getClientResources: vi.fn(),
}));

vi.mock('@/lib/store/runs', () => ({
  insertRunRequest: vi.fn(),
  listRuns: vi.fn(),
}));

vi.mock('@/lib/store/pg', () => ({
  getRunStorePool: vi.fn(() => ({ query: vi.fn() })),
}));

// We do NOT mock mapToRunInput so we can assert what it actually produces.
// Its pure function behavior is exercised through the spy on the store call.

// ---------------------------------------------------------------------------
// Import route after mocks are established.
// ---------------------------------------------------------------------------

import { GET, POST } from './route';
import { getPool } from '@/lib/db';
import { getClientProfile, getClientResources } from '@/lib/queries';
import { insertRunRequest, listRuns } from '@/lib/store/runs';
import { getRunStorePool } from '@/lib/store/pg';

const mockGetPool = vi.mocked(getPool);
const mockGetClientProfile = vi.mocked(getClientProfile);
const mockGetClientResources = vi.mocked(getClientResources);
const mockInsertRunRequest = vi.mocked(insertRunRequest);
const mockListRuns = vi.mocked(listRuns);
const mockGetRunStorePool = vi.mocked(getRunStorePool);

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

const FAKE_DB_POOL = { query: vi.fn() };
const FAKE_STORE_POOL = { query: vi.fn() };

const FAKE_PROFILE = {
  businessProfile: {
    business_identity: 'Test business',
    primary_verticals: ['SaaS'],
    explicit_out_of_scope: ['ecommerce'],
    inventory_nature: 'B2B software',
  },
  geo: {
    targetGeographies: ['US'],
    serviceAreas: ['New York'],
  },
};

const FAKE_RESOURCES = [
  { id: 'res-1', type: 'service' as const, name: 'Service One', description: 'Desc one' },
  { id: 'res-2', type: 'product' as const, name: 'Product Two', description: 'Desc two' },
];

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPool.mockReturnValue(FAKE_DB_POOL as unknown as ReturnType<typeof getPool>);
    mockGetRunStorePool.mockReturnValue(FAKE_STORE_POOL as unknown as ReturnType<typeof getRunStorePool>);
    mockGetClientProfile.mockResolvedValue(FAKE_PROFILE);
    mockGetClientResources.mockResolvedValue(FAKE_RESOURCES);
    mockInsertRunRequest.mockResolvedValue('test-id');
  });

  it('happy path: calls insertRunRequest and returns 202 { runId, status: queued }', async () => {
    const req = makeRequest({ clientId: 'client-abc', resourceIds: ['res-1'] });
    const res = await POST(req);

    expect(res.status).toBe(202);

    const body = await res.json() as { runId: string; status: string };
    expect(body.status).toBe('queued');
    expect(body.runId).toMatch(/^client-abc-\d+$/);

    // insertRunRequest must be called with the store pool, not the DB pool
    expect(mockInsertRunRequest).toHaveBeenCalledOnce();
    const [calledPool, args] = mockInsertRunRequest.mock.calls[0];
    expect(calledPool).toBe(FAKE_STORE_POOL);

    // id matches the runId in the response
    expect(args.id).toBe(body.runId);
    expect(args.clientId).toBe('client-abc');
    expect(args.resourceIds).toEqual(['res-1']);

    // runInput is the output from mapToRunInput -- check a few structural fields
    expect(args.runInput).toBeDefined();
    const runInput = args.runInput as Record<string, unknown>;
    expect(runInput.clientId).toBe('client-abc');
    expect(runInput.runId).toBe(body.runId);
    expect(Array.isArray(runInput.resources)).toBe(true);
  });

  it('threads maxResumeRounds into knobOverrides passed to mapToRunInput', async () => {
    const req = makeRequest({
      clientId: 'client-abc',
      resourceIds: ['res-1'],
      knobs: { maxKeywords: 50 },
      maxResumeRounds: 3,
    });
    const res = await POST(req);
    expect(res.status).toBe(202);

    const [, args] = mockInsertRunRequest.mock.calls[0];
    const runInput = args.runInput as { knobs: Record<string, unknown> };
    // knobs must contain both the original key AND maxResumeRounds
    expect(runInput.knobs).toBeDefined();
    expect(runInput.knobs.maxKeywords).toBe(50);
    expect(runInput.knobs.maxResumeRounds).toBe(3);
  });

  it('returns 400 when clientId is missing', async () => {
    const req = makeRequest({ resourceIds: ['res-1'] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockInsertRunRequest).not.toHaveBeenCalled();
  });

  it('returns 400 when resourceIds is empty array', async () => {
    const req = makeRequest({ clientId: 'client-abc', resourceIds: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockInsertRunRequest).not.toHaveBeenCalled();
  });

  it('returns 400 when no resources match resourceIds', async () => {
    const req = makeRequest({ clientId: 'client-abc', resourceIds: ['res-nonexistent'] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockInsertRunRequest).not.toHaveBeenCalled();
  });

  it('returns 500 when DB fetch throws', async () => {
    mockGetClientProfile.mockRejectedValue(new Error('DB connection refused'));
    const req = makeRequest({ clientId: 'client-abc', resourceIds: ['res-1'] });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(mockInsertRunRequest).not.toHaveBeenCalled();
  });
});

describe('GET /api/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRunStorePool.mockReturnValue(FAKE_STORE_POOL as unknown as ReturnType<typeof getRunStorePool>);
  });

  it('returns { runs } from listRuns', async () => {
    const fakeRuns = [
      { runId: 'r1', clientId: 'c1', status: 'completed', spend: null, selected: null, clusters: null, startedAt: null, finishedAt: null },
    ];
    mockListRuns.mockResolvedValue(fakeRuns);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as { runs: typeof fakeRuns };
    expect(body.runs).toEqual(fakeRuns);
    expect(mockListRuns).toHaveBeenCalledWith(FAKE_STORE_POOL);
  });
});

describe('No pipeline imports in route source', () => {
  it('route.ts does not import runPipeline or agentic-akr', () => {
    const routePath = path.join(process.cwd(), 'app/api/runs/route.ts');
    const src = fs.readFileSync(routePath, 'utf-8');
    expect(src).not.toContain('runPipeline');
    expect(src).not.toContain('agentic-akr');
  });
});
