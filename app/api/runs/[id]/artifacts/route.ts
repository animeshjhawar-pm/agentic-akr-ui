// app/api/runs/[id]/artifacts/route.ts
//
// GET /api/runs/:id/artifacts
//
// Returns the persisted artifacts (lane outputs, steps, checkpoints, planner
// decisions, substeps) for a run, oldest first. Empty until the engine change
// that writes run_artifacts is deployed.

import { NextResponse } from 'next/server';
import { getRunStorePool } from '@/lib/store/pg';
import { getRunArtifacts } from '@/lib/store/runs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const artifacts = await getRunArtifacts(getRunStorePool(), id);
  return NextResponse.json({ artifacts });
}
