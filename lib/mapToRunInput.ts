/** Local mirror of the AKR RunInput shape (do NOT import from agentic-akr package). */
export interface RunInput {
  runId: string;
  clientId: string;
  targetGeo: { locationCode: number; languageCode: string };
  targetPages: number;
  resources: { resourceId: string; name: string; details: string }[];
  businessProfile: {
    summary: string;
    locationDependent: boolean;
    servedAreas: string[];
    primaryVerticals?: string[];
    explicitOutOfScope?: string[];
  };
  knobs?: object;
}

/** Geo lookup keyed by lowercase country code. Export so callers can extend it. */
export const GEO_LOOKUP: Record<string, { locationCode: number; languageCode: string }> = {
  us: { locationCode: 2840, languageCode: 'en' },
};

const DEFAULT_GEO = { locationCode: 2840, languageCode: 'en' };

/** Markers that indicate nationwide (non-specific) coverage -- case-insensitive match. */
const NATIONWIDE_MARKERS = new Set(['nationwide', 'united states', 'usa', 'us']);

function isNationwideMarker(area: string): boolean {
  return NATIONWIDE_MARKERS.has(area.toLowerCase().trim());
}

export interface MapToRunInputParams {
  clientId: string;
  runId: string;
  profile: {
    businessProfile: {
      business_identity?: string;
      primary_verticals?: string[];
      explicit_out_of_scope?: string[];
      inventory_nature?: string;
    };
  };
  geo: {
    targetGeographies: string[];
    serviceAreas: string[];
  };
  selectedResources: { id: string; type: 'product' | 'service'; name: string; description: string }[];
  targetPages?: number;
  knobOverrides?: object;
  outOfScopeAddendum?: string;
}

/**
 * Pure function: maps a selected client + chosen resources into the AKR RunInput
 * shape that the pipeline consumes. No I/O side effects.
 */
export function mapToRunInput(input: MapToRunInputParams): RunInput {
  const { clientId, runId, profile, geo, selectedResources, targetPages, knobOverrides, outOfScopeAddendum } = input;
  const bp = profile.businessProfile;

  // Compose summary
  const summaryParts: string[] = [];
  if (bp.business_identity) summaryParts.push(bp.business_identity);
  if (bp.inventory_nature) summaryParts.push(bp.inventory_nature);
  const summary = summaryParts.join('\n\n');

  // Explicit out-of-scope
  const explicitOutOfScope = [...(bp.explicit_out_of_scope ?? [])];
  if (outOfScopeAddendum && outOfScopeAddendum.trim().length > 0) {
    explicitOutOfScope.push(outOfScopeAddendum);
  }

  // Service areas: drop nationwide markers
  const servedAreas = geo.serviceAreas.filter((a) => !isNationwideMarker(a));
  const locationDependent = servedAreas.length > 0;

  // Target geo: use first entry from targetGeographies, case-insensitive lookup
  const firstGeo = geo.targetGeographies[0]?.toLowerCase() ?? '';
  const targetGeo = GEO_LOOKUP[firstGeo] ?? DEFAULT_GEO;

  // Resources mapping
  const resources = selectedResources.map((r) => ({
    resourceId: r.id,
    name: r.name,
    details: r.description,
  }));

  return {
    runId,
    clientId,
    targetGeo,
    targetPages: targetPages ?? 10,
    resources,
    businessProfile: {
      summary,
      locationDependent,
      servedAreas,
      primaryVerticals: bp.primary_verticals ?? [],
      explicitOutOfScope,
    },
    knobs: knobOverrides,
  };
}
