import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { withNoStore } from '@/server/security/csrf';
import { runDevSeed } from '@/server/dev/seed';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  if (process.env.NODE_ENV === 'production') {
    return withNoStore(
      withRequestId(NextResponse.json({ error: 'Seed dev interdit en production.' }, { status: 403 }), requestId)
    );
  }
  if (process.env.ENABLE_DEV_SEED !== '1') {
    return withNoStore(
      withRequestId(
        NextResponse.json({ error: 'ENABLE_DEV_SEED=1 requis pour le seed dev.' }, { status: 403 }),
        requestId
      )
    );
  }
  try {
    const result = await runDevSeed();
    return withNoStore(withRequestId(NextResponse.json({ ok: true, result }, { status: 200 }), requestId));
  } catch (err) {
    console.error('dev seed failed', err);
    return withNoStore(
      withRequestId(NextResponse.json({ error: 'Seed dev failed' }, { status: 500 }), requestId)
    );
  }
}
