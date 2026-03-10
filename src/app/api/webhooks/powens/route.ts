import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/server/db/client';
import { syncPowensData } from '@/server/services/powensSync';

/**
 * Webhook Powens — hors middleware (pas d'auth cookie).
 * Vérifie la signature HMAC-SHA256 du payload.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.POWENS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook:powens] POWENS_WEBHOOK_SECRET non configuré');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  // Lire le body brut
  const rawBody = await req.text();

  // Vérifier la signature
  const signature = req.headers.get('powens-signature') || req.headers.get('biapi-signature') || '';
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  if (!signature || signature !== expected) {
    console.warn('[webhook:powens] Signature invalide');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parser le payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.type as string | undefined;
  const powensUserId = payload.id_user as number | undefined;

  if (!eventType || !powensUserId) {
    return NextResponse.json({ ok: true }); // Event non pertinent
  }

  // Traiter les événements de synchronisation
  if (eventType === 'CONNECTION_SYNCED' || eventType === 'ACCOUNT_SYNCED') {
    try {
      const conn = await prisma.powensConnection.findFirst({
        where: { powensUserId },
        select: { userId: true },
      });

      if (conn) {
        await syncPowensData(conn.userId);
      }
    } catch (e) {
      console.error('[webhook:powens] Erreur sync:', e);
      // On retourne 200 pour ne pas que Powens re-envoie le webhook
    }
  }

  return NextResponse.json({ ok: true });
}
