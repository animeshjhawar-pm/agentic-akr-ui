// app/api/clients/route.ts
//
// GET /api/clients
// Returns { clients: ClientRow[] } from listClients().

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { listClients } from '@/lib/queries';

export async function GET(): Promise<Response> {
  try {
    const client = getPool();
    const clients = await listClients(client);
    return NextResponse.json({ clients });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
