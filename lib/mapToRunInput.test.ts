import { describe, it, expect } from 'vitest';
import { mapToRunInput } from './mapToRunInput';

const kitchenFactoryFixture = {
  clientId: 'client-123',
  runId: 'run-abc',
  profile: {
    businessProfile: {
      business_identity: 'We manufacture high-quality kitchen cabinetry.',
      primary_verticals: ['Kitchen Cabinets', 'Bathroom Vanities'],
      explicit_out_of_scope: ['DIY', 'Retail'],
      inventory_nature: 'Custom-order only, no in-stock inventory.',
    },
  },
  geo: {
    targetGeographies: ['us'],
    serviceAreas: ['Los Angeles', 'Orange County', 'Nationwide'],
  },
  selectedResources: [
    { id: 'res-1', type: 'product' as const, name: 'Shaker Cabinet', description: 'Classic shaker-style cabinet in maple.' },
    { id: 'res-2', type: 'service' as const, name: 'Cabinet Installation', description: 'Professional installation service.' },
  ],
};

describe('mapToRunInput', () => {
  it('passes through runId and clientId', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.runId).toBe('run-abc');
    expect(result.clientId).toBe('client-123');
  });

  it('composes summary from business_identity and inventory_nature', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.businessProfile.summary).toContain('We manufacture high-quality kitchen cabinetry.');
    expect(result.businessProfile.summary).toContain('Custom-order only, no in-stock inventory.');
  });

  it('includes primary_verticals', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.businessProfile.primaryVerticals).toEqual(['Kitchen Cabinets', 'Bathroom Vanities']);
  });

  it('includes explicit_out_of_scope with DIY', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.businessProfile.explicitOutOfScope).toContain('DIY');
    expect(result.businessProfile.explicitOutOfScope).toContain('Retail');
  });

  it('appends outOfScopeAddendum when provided', () => {
    const result = mapToRunInput({ ...kitchenFactoryFixture, outOfScopeAddendum: 'No commercial projects.' });
    expect(result.businessProfile.explicitOutOfScope).toContain('No commercial projects.');
  });

  it('does NOT append empty outOfScopeAddendum', () => {
    const result = mapToRunInput({ ...kitchenFactoryFixture, outOfScopeAddendum: '' });
    expect(result.businessProfile.explicitOutOfScope).not.toContain('');
    expect(result.businessProfile.explicitOutOfScope).toHaveLength(2);
  });

  it('sets locationDependent true when specific service areas exist', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.businessProfile.locationDependent).toBe(true);
  });

  it('sets locationDependent false when only nationwide markers', () => {
    const result = mapToRunInput({
      ...kitchenFactoryFixture,
      geo: { targetGeographies: ['us'], serviceAreas: ['Nationwide', 'USA', 'United States', 'US'] },
    });
    expect(result.businessProfile.locationDependent).toBe(false);
  });

  it('sets locationDependent false when serviceAreas is empty', () => {
    const result = mapToRunInput({
      ...kitchenFactoryFixture,
      geo: { targetGeographies: ['us'], serviceAreas: [] },
    });
    expect(result.businessProfile.locationDependent).toBe(false);
  });

  it('drops nationwide markers from servedAreas', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.businessProfile.servedAreas).toEqual(['Los Angeles', 'Orange County']);
    expect(result.businessProfile.servedAreas).not.toContain('Nationwide');
  });

  it('maps targetGeo for "us" to {locationCode: 2840, languageCode: "en"}', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.targetGeo).toEqual({ locationCode: 2840, languageCode: 'en' });
  });

  it('maps targetGeo case-insensitively (US uppercase)', () => {
    const result = mapToRunInput({
      ...kitchenFactoryFixture,
      geo: { ...kitchenFactoryFixture.geo, targetGeographies: ['US'] },
    });
    expect(result.targetGeo).toEqual({ locationCode: 2840, languageCode: 'en' });
  });

  it('defaults targetGeo to US when unknown geo', () => {
    const result = mapToRunInput({
      ...kitchenFactoryFixture,
      geo: { ...kitchenFactoryFixture.geo, targetGeographies: ['zz'] },
    });
    expect(result.targetGeo).toEqual({ locationCode: 2840, languageCode: 'en' });
  });

  it('defaults targetGeo to US when targetGeographies is empty', () => {
    const result = mapToRunInput({
      ...kitchenFactoryFixture,
      geo: { ...kitchenFactoryFixture.geo, targetGeographies: [] },
    });
    expect(result.targetGeo).toEqual({ locationCode: 2840, languageCode: 'en' });
  });

  it('maps selectedResources to {resourceId, name, details}', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0]).toEqual({
      resourceId: 'res-1',
      name: 'Shaker Cabinet',
      details: 'Classic shaker-style cabinet in maple.',
    });
    expect(result.resources[1]).toEqual({
      resourceId: 'res-2',
      name: 'Cabinet Installation',
      details: 'Professional installation service.',
    });
  });

  it('defaults targetPages to 10 when not provided', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.targetPages).toBe(10);
  });

  it('uses provided targetPages', () => {
    const result = mapToRunInput({ ...kitchenFactoryFixture, targetPages: 25 });
    expect(result.targetPages).toBe(25);
  });

  it('passes through knobOverrides as knobs', () => {
    const knobs = { model: 'gpt-4o', temperature: 0.3 };
    const result = mapToRunInput({ ...kitchenFactoryFixture, knobOverrides: knobs });
    expect(result.knobs).toEqual(knobs);
  });

  it('sets knobs to undefined when no knobOverrides', () => {
    const result = mapToRunInput(kitchenFactoryFixture);
    expect(result.knobs).toBeUndefined();
  });
});
