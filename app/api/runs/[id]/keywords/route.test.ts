// app/api/runs/[id]/keywords/route.test.ts
//
// Tests for GET /api/runs/:id/keywords

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KeywordRow } from '@/lib/store/runs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetRunKeywords = vi.fn<[unknown, string], Promise<KeywordRow[]>>();
const mockGetRunStorePool = vi.fn(() => ({}));

vi.mock('@/lib/store/runs', () => ({
  getRunKeywords: (...args: Parameters<typeof mockGetRunKeywords>) =>
    mockGetRunKeywords(...args),
}));

vi.mock('@/lib/store/pg', () => ({
  getRunStorePool: () => mockGetRunStorePool(),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function callRoute(id: string): Promise<Response> {
  const { GET } = await import('./route');
  const req = new Request(`http://localhost/api/runs/${id}/keywords`);
  return GET(req, { params: Promise.resolve({ id }) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/runs/:id/keywords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns keywords array wrapped in { keywords }', async () => {
    const mockKeywords: KeywordRow[] = [
      { term: 'seo tools', volume: 1200, kd: 42, score: 0.85, intent: 'commercial', source: 'serp' },
      { term: 'keyword research', volume: 800, kd: 55, score: 0.72, intent: 'informational', source: 'trends' },
    ];
    mockGetRunKeywords.mockResolvedValue(mockKeywords);

    const res = await callRoute('run-1');
    expect(res.status).toBe(200);

    const body = await res.json() as { keywords: KeywordRow[] };
    expect(body.keywords).toHaveLength(2);
    expect(body.keywords[0].term).toBe('seo tools');
    expect(body.keywords[1].term).toBe('keyword research');
  });

  it('returns empty keywords array when none found', async () => {
    mockGetRunKeywords.mockResolvedValue([]);

    const res = await callRoute('run-empty');
    const body = await res.json() as { keywords: KeywordRow[] };
    expect(body.keywords).toEqual([]);
  });

  it('calls getRunKeywords with the correct runId', async () => {
    mockGetRunKeywords.mockResolvedValue([]);

    await callRoute('run-abc');

    expect(mockGetRunKeywords).toHaveBeenCalledWith(expect.anything(), 'run-abc');
  });
});
