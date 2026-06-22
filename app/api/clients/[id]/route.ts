// app/api/clients/[id]/route.ts
//
// GET /api/clients/:id
// Returns { profile: ClientProfile, resources: ResourceRow[] }.

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getClientProfile, getClientResources } from '@/lib/queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const client = getPool();
    const [profile, resources] = await Promise.all([
      getClientProfile(client, id),
      getClientResources(client, id),
    ]);
    return NextResponse.json({ profile, resources });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
