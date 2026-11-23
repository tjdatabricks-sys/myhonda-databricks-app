import { NextResponse } from 'next/server';
import { withApiErrors } from '@/lib/server/api-errors';
import { assertReady } from '@/lib/server/metadata';

export const dynamic = 'force-dynamic';
export const GET = withApiErrors(async () => {
  await assertReady();
  return NextResponse.json({ status: 'ready', tables: 39, checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
});
