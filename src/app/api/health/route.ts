import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Deployment liveness: the HTTP server can serve requests. Warehouse validation
// belongs to /api/ready, so a data configuration issue cannot stop the app UI.
export async function GET() {
  return NextResponse.json({ status: 'alive', checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
