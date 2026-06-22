// app/api/runs/[id]/keywords/route.ts
//
// GET /api/runs/:id/keywords
//
// Returns the keyword list for a run ordered by score DESC.

import { NextResponse } from 'next/server';
import { getRunStorePool } from '@/lib/store/pg';
import { getRunKeywords } from '@/lib/store/runs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const keywords = await getRunKeywords(getRunStorePool(), id);
  return NextResponse.json({ keywords });
}
