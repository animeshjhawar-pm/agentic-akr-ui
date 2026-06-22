import { describe, it, expect } from 'vitest';
import { listClients, getClientProfile, getClientResources } from './queries';

// ---------------------------------------------------------------------------
// Fake QueryClient helpers
// ---------------------------------------------------------------------------

function makeFakeClient(rows: Record<string, unknown>[]) {
  const calls: { text: string; params?: unknown[] }[] = [];
  const client = {
    calls,
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows };
    },
  };
  return client;
}

// ---------------------------------------------------------------------------
// listClients
// ---------------------------------------------------------------------------

describe('listClients', () => {
  it('queries the projects table with correct filters', async () => {
    const fake = makeFakeClient([]);
    await listClients(fake);
    const { text } = fake.calls[0];
    expect(text).toContain('projects');
    expect(text).toContain("additional_info ? 'business_profile'");
    expect(text).toContain('d_at IS NULL');
    expect(text).toContain('resources');
  });

  it('maps rows to { id, name }', async () => {
    const fake = makeFakeClient([
      { id: 'abc', name: 'Acme Corp' },
      { id: 'def', name: 'Beta LLC' },
    ]);
    const result = await listClients(fake);
    expect(result).toEqual([
      { id: 'abc', name: 'Acme Corp' },
      { id: 'def', name: 'Beta LLC' },
    ]);
  });

  it('returns empty array when no rows', async () => {
    const fake = makeFakeClient([]);
    const result = await listClients(fake);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getClientProfile
// ---------------------------------------------------------------------------

describe('getClientProfile', () => {
  it('uses parameterized query -- id in params not interpolated into SQL', async () => {
    const clientId = 'test-uuid-1234';
    const fake = makeFakeClient([]);
    await getClientProfile(fake, clientId);
    const { text, params } = fake.calls[0];
    // Must NOT contain the raw id in the SQL string
    expect(text).not.toContain(clientId);
    // Must pass id as first param
    expect(params).toEqual([clientId]);
  });

  it('queries projects table with d_at IS NULL', async () => {
    const fake = makeFakeClient([]);
    await getClientProfile(fake, 'some-id');
    const { text } = fake.calls[0];
    expect(text).toContain('projects');
    expect(text).toContain('d_at IS NULL');
  });

  it('maps row to documented shape', async () => {
    const bp = { business_identity: 'SaaS', primary_verticals: ['tech'] };
    const tg = ['us', 'uk'];
    const sa = ['California'];
    const fake = makeFakeClient([
      {
        business_profile: bp,
        target_geographies: tg,
        service_areas: sa,
      },
    ]);
    const result = await getClientProfile(fake, 'id-1');
    expect(result.businessProfile).toEqual(bp);
    expect(result.geo.targetGeographies).toEqual(tg);
    expect(result.geo.serviceAreas).toEqual(sa);
  });

  it('returns empty defaults when row is missing', async () => {
    const fake = makeFakeClient([]);
    const result = await getClientProfile(fake, 'id-x');
    expect(result.businessProfile).toEqual({});
    expect(result.geo.targetGeographies).toEqual([]);
    expect(result.geo.serviceAreas).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getClientResources
// ---------------------------------------------------------------------------

describe('getClientResources', () => {
  it('queries resources table with parameterized id', async () => {
    const clientId = 'proj-uuid-5678';
    const fake = makeFakeClient([]);
    await getClientResources(fake, clientId);
    const { text, params } = fake.calls[0];
    expect(text).toContain('resources');
    // id must be a param, not interpolated
    expect(text).not.toContain(clientId);
    expect(params).toEqual([clientId]);
  });

  it('filters d_at IS NULL', async () => {
    const fake = makeFakeClient([]);
    await getClientResources(fake, 'any-id');
    expect(fake.calls[0].text).toContain('d_at IS NULL');
  });

  it('maps service rows correctly', async () => {
    const fake = makeFakeClient([
      {
        id: 'r1',
        type: 'service',
        details: {
          service_name: 'Support',
          service_description: 'Customer support',
        },
      },
    ]);
    const result = await getClientResources(fake, 'p1');
    expect(result).toEqual([
      { id: 'r1', type: 'service', name: 'Support', description: 'Customer support' },
    ]);
  });

  it('maps product rows with composed description', async () => {
    const fake = makeFakeClient([
      {
        id: 'r2',
        type: 'product',
        details: {
          product_name: 'Widget',
          applications_use_cases: 'Automates tasks',
          key_features_usps: 'Fast and reliable',
          technical_specifications: 'Node 20, TypeScript',
        },
      },
    ]);
    const result = await getClientResources(fake, 'p1');
    expect(result[0].name).toBe('Widget');
    expect(result[0].description).toContain('Widget');
    expect(result[0].description).toContain('Automates tasks');
    expect(result[0].description).toContain('Fast and reliable');
    expect(result[0].description).toContain('Node 20, TypeScript');
  });

  it('does not include undefined fields in product description', async () => {
    const fake = makeFakeClient([
      {
        id: 'r3',
        type: 'product',
        details: { product_name: 'MinProd' },
      },
    ]);
    const result = await getClientResources(fake, 'p1');
    expect(result[0].description).toBe('MinProd');
  });
});
