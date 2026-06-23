// app/api/runs/[id]/route.ts
//
// GET /api/runs/:id?since=<seq>
//
// Returns events since the given cursor seq, the max seq seen in this batch,
// and the current run status. The client uses these to drive incremental polling.

import { NextResponse } from 'next/server';
import { getRunStorePool } from '@/lib/store/pg';
import { getRunEventsSince, getRun } from '@/lib/store/runs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const since = sinceParam !== null ? parseInt(sinceParam, 10) : 0;

  const pool = getRunStorePool();
  const [eventRows, run] = await Promise.all([
    getRunEventsSince(pool, id, isNaN(since) ? 0 : since),
    getRun(pool, id),
  ]);

  const events = eventRows.map((r) => r.event);
  const maxSeq =
    eventRows.length > 0
      ? Math.max(...eventRows.map((r) => r.seq))
      : since;

  return NextResponse.json({
    runId: id,
    events,
    maxSeq,
    status: run?.status ?? 'pending',
    // Live totals from the runs row (spend updates in real time during a run;
    // selected/clusters populate near completion).
    spend: run?.spend ?? null,
    selected: run?.selected ?? null,
    clusters: run?.clusters ?? null,
    // Timestamps for the "time taken" counter (ISO strings via JSON Date serialization).
    startedAt: run?.startedAt ?? null,
    finishedAt: run?.finishedAt ?? null,
    createdAt: run?.createdAt ?? null,
  });
}
