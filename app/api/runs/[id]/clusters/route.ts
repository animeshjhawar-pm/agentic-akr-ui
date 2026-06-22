// app/api/runs/[id]/clusters/route.ts
//
// GET /api/runs/:id/clusters
//
// Returns the cluster result for a run, or an empty shape if not available yet.

import { NextResponse } from 'next/server';
import { getRunStorePool } from '@/lib/store/pg';
import { getRunClusters } from '@/lib/store/runs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const clusters = await getRunClusters(getRunStorePool(), id);
  return NextResponse.json(clusters ?? { clusters: [], meta: null });
}
