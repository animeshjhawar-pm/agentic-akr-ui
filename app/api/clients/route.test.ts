// app/api/clients/route.test.ts
//
// Unit test for GET /api/clients route handler.
// Mocks lib/db (getPool) and lib/queries (listClients) to avoid real DB calls.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the route handler.
vi.mock('@/lib/db', () => ({
  getPool: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('@/lib/queries', () => ({
  listClients: vi.fn(),
}));

import { GET } from './route';
import { listClients } from '@/lib/queries';

const mockListClients = vi.mocked(listClients);

describe('GET /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { clients } with 200 when listClients resolves', async () => {
    const fakeClients = [
      { id: 'c1', name: 'Client One' },
      { id: 'c2', name: 'Client Two' },
    ];
    mockListClients.mockResolvedValue(fakeClients);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as { clients: typeof fakeClients };
    expect(body.clients).toEqual(fakeClients);
  });

  it('returns 500 with error message when listClients throws', async () => {
    mockListClients.mockRejectedValue(new Error('DB connection failed'));

    const res = await GET();
    expect(res.status).toBe(500);

    const body = await res.json() as { error: string };
    expect(body.error).toBe('DB connection failed');
  });
});
