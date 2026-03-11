import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { readLocalFile } from '@/server/storage/local';
import crypto from 'crypto';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/**
 * GET /api/share/[token]/documents/[documentId]/download
 * Public document download by share token — no auth required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; documentId: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:doc:download'),
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken, documentId: rawDocId } = await params;
  if (!rawToken?.trim()) {
    return NextResponse.json({ error: 'Token requis.' }, { status: 400 });
  }

  const tokenHash = hashToken(rawToken.trim());

  const shareToken = await prisma.projectShareToken.findUnique({
    where: { token: tokenHash },
    select: {
      expiresAt: true,
      revokedAt: true,
      projectId: true,
      businessId: true,
    },
  });

  if (!shareToken) {
    return NextResponse.json({ error: 'Lien de partage invalide.' }, { status: 404 });
  }

  if (shareToken.revokedAt) {
    return NextResponse.json({ error: 'Ce lien a été révoqué.' }, { status: 410 });
  }

  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré.' }, { status: 410 });
  }

  let documentId: bigint;
  try {
    documentId = BigInt(rawDocId);
  } catch {
    return NextResponse.json({ error: 'documentId invalide.' }, { status: 400 });
  }

  const doc = await prisma.businessDocument.findFirst({
    where: {
      id: documentId,
      projectId: shareToken.projectId,
      businessId: shareToken.businessId,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }

  try {
    const fileBuffer = await readLocalFile(doc.storageKey);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.filename)}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 });
  }
}
