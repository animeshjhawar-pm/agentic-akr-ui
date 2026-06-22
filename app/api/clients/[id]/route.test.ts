// app/api/clients/[id]/route.test.ts
//
// Unit tests for GET /api/clients/[id] route handler.
// Mocks lib/db (getPool) and lib/queries so no real DB calls are made.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the route handler.
vi.mock('@/lib/db', () => ({
  getPool: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('@/lib/queries', () => ({
  getClientProfile: vi.fn(),
  getClientResources: vi.fn(),
}));

import { GET } from './route';
import { getClientProfile, getClientResources } from '@/lib/queries';

const mockGetClientProfile = vi.mocked(getClientProfile);
const mockGetClientResources = vi.mocked(getClientResources);

const fakeProfile = {
  businessProfile: { business_identity: 'ACME Corp', inventory_nature: 'SaaS' },
  geo: { targetGeographies: ['us'], serviceAreas: [] },
};

const fakeResources = [
  { id: 'res-1', type: 'service' as const, name: 'Widget Pro', description: 'A great widget' },
];

/** Build a minimal params object matching the Next.js async params shape. */
function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/clients/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { profile, resources } with 200 for a known client id', async () => {
    mockGetClientProfile.mockResolvedValue(fakeProfile);
    mockGetClientResources.mockResolvedValue(fakeResources);

    const req = new Request('http://localhost/api/clients/c1');
    const res = await GET(req, makeContext('c1'));

    expect(res.status).toBe(200);
    const body = await res.json() as { profile: typeof fakeProfile; resources: typeof fakeResources };
    expect(body.profile).toEqual(fakeProfile);
    expect(body.resources).toEqual(fakeResources);
  });

  it('returns 500 with error message when a query throws', async () => {
    mockGetClientProfile.mockRejectedValue(new Error('DB timeout'));
    mockGetClientResources.mockResolvedValue(fakeResources);

    const req = new Request('http://localhost/api/clients/bad');
    const res = await GET(req, makeContext('bad'));

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('DB timeout');
  });
});
