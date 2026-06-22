// app/api/runs/[id]/clusters/route.test.ts
//
// Tests for GET /api/runs/:id/clusters

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClustersResult } from '@/lib/store/runs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetRunClusters = vi.fn<[unknown, string], Promise<ClustersResult | null>>();
const mockGetRunStorePool = vi.fn(() => ({}));

vi.mock('@/lib/store/runs', () => ({
  getRunClusters: (...args: Parameters<typeof mockGetRunClusters>) =>
    mockGetRunClusters(...args),
}));

vi.mock('@/lib/store/pg', () => ({
  getRunStorePool: () => mockGetRunStorePool(),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function callRoute(id: string): Promise<Response> {
  const { GET } = await import('./route');
  const req = new Request(`http://localhost/api/runs/${id}/clusters`);
  return GET(req, { params: Promise.resolve({ id }) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/runs/:id/clusters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns clusters and meta when data exists', async () => {
    const mockResult: ClustersResult = {
      clusters: [{ id: 'c1', label: 'Cluster A' }],
      meta: { version: 1 },
    };
    mockGetRunClusters.mockResolvedValue(mockResult);

    const res = await callRoute('run-1');
    expect(res.status).toBe(200);

    const body = await res.json() as ClustersResult;
    expect(body.clusters).toHaveLength(1);
    expect(body.meta).toEqual({ version: 1 });
  });

  it('returns empty clusters shape when no data', async () => {
    mockGetRunClusters.mockResolvedValue(null);

    const res = await callRoute('run-1');
    expect(res.status).toBe(200);

    const body = await res.json() as { clusters: unknown[]; meta: null };
    expect(body.clusters).toEqual([]);
    expect(body.meta).toBeNull();
  });

  it('calls getRunClusters with the correct runId', async () => {
    mockGetRunClusters.mockResolvedValue(null);

    await callRoute('run-xyz');

    expect(mockGetRunClusters).toHaveBeenCalledWith(expect.anything(), 'run-xyz');
  });
});
