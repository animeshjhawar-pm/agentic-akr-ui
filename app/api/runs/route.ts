// app/api/runs/route.ts
//
// POST /api/runs -- trigger a run by inserting into run_requests (no in-process pipeline).
// GET  /api/runs -- list all known runs from the run store.
//
// The pipeline worker (a separate process/service) polls run_requests and
// claims rows -- this route only enqueues. No SSE, no ReadableStream, no abort.

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getClientProfile, getClientResources } from '@/lib/queries';
import { mapToRunInput } from '@/lib/mapToRunInput';
import { insertRunRequest, listRuns } from '@/lib/store/runs';
import { getRunStorePool } from '@/lib/store/pg';

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

interface RunRequestBody {
  clientId: string;
  resourceIds: string[];
  knobs?: object;
  outOfScope?: string;
  targetPages?: number;
  maxResumeRounds?: number;
}

function parseBody(raw: unknown): RunRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body['clientId'] !== 'string') return null;
  if (!Array.isArray(body['resourceIds'])) return null;
  if (!body['resourceIds'].every((r) => typeof r === 'string')) return null;
  return {
    clientId: body['clientId'] as string,
    resourceIds: body['resourceIds'] as string[],
    knobs:
      typeof body['knobs'] === 'object' && body['knobs'] !== null
        ? (body['knobs'] as object)
        : undefined,
    outOfScope:
      typeof body['outOfScope'] === 'string' ? body['outOfScope'] : undefined,
    targetPages:
      typeof body['targetPages'] === 'number' &&
      Number.isFinite(body['targetPages']) &&
      body['targetPages'] > 0
        ? (body['targetPages'] as number)
        : undefined,
    maxResumeRounds:
      typeof body['maxResumeRounds'] === 'number' &&
      Number.isFinite(body['maxResumeRounds'])
        ? (body['maxResumeRounds'] as number)
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// GET /api/runs -- list all known run rows
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  const runs = await listRuns(getRunStorePool());
  return NextResponse.json({ runs });
}

// ---------------------------------------------------------------------------
// POST /api/runs -- enqueue a run request
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  // Parse and validate body.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid fields: clientId (string), resourceIds (string[]) required',
      },
      { status: 400 },
    );
  }

  const { clientId, resourceIds, knobs, outOfScope, targetPages, maxResumeRounds } = body;

  if (resourceIds.length === 0) {
    return NextResponse.json(
      { error: 'resourceIds must not be empty' },
      { status: 400 },
    );
  }

  // Fetch profile + resources from the gw_stormbreaker DB.
  let profile: Awaited<ReturnType<typeof getClientProfile>>;
  let allResources: Awaited<ReturnType<typeof getClientResources>>;
  try {
    const dbPool = getPool();
    [profile, allResources] = await Promise.all([
      getClientProfile(dbPool, clientId),
      getClientResources(dbPool, clientId),
    ]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'DB error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Filter resources to the requested subset.
  const selectedResources = allResources.filter((r) => resourceIds.includes(r.id));
  if (selectedResources.length === 0) {
    return NextResponse.json(
      { error: 'No matching resources found for resourceIds' },
      { status: 400 },
    );
  }

  const runId = `${clientId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  // Merge maxResumeRounds into knob overrides.
  const knobOverrides = {
    ...(knobs ?? {}),
    ...(maxResumeRounds !== undefined ? { maxResumeRounds } : {}),
  };

  // Build RunInput via the pure mapToRunInput helper (no pipeline import).
  const runInput = mapToRunInput({
    clientId,
    runId,
    profile: {
      businessProfile: profile.businessProfile as Record<string, unknown> & {
        business_identity?: string;
        primary_verticals?: string[];
        explicit_out_of_scope?: string[];
        inventory_nature?: string;
      },
    },
    geo: profile.geo,
    selectedResources,
    targetPages,
    knobOverrides: Object.keys(knobOverrides).length > 0 ? knobOverrides : undefined,
    outOfScopeAddendum: outOfScope,
  });

  // Insert into run_requests so the worker can claim it.
  await insertRunRequest(getRunStorePool(), {
    id: runId,
    clientId,
    resourceIds,
    runInput,
  });

  return NextResponse.json({ runId, status: 'queued' }, { status: 202 });
}
