import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { DocumentKind } from '@/generated/prisma';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { saveLocalFile } from '@/server/storage/local';
import crypto from 'crypto';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

/**
 * POST /api/share/[token]/upload
 * Public file upload by share token — no auth required.
 * Token must have allowClientUpload enabled.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:upload'),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken } = await params;
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
      allowClientUpload: true,
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

  if (!shareToken.allowClientUpload) {
    return NextResponse.json({ error: 'L\'envoi de fichiers n\'est pas autorisé pour ce lien.' }, { status: 403 });
  }

  // Parse form data
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'FormData requis.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier requis.' }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo).' }, { status: 400 });
  }

  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json({ error: 'Type de fichier non autorisé.' }, { status: 400 });
  }

  // Extract optional title
  const titleRaw = form.get('title');
  const title = `[Client] ${typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : file.name}`;

  // Find business owner to attribute the document
  const owner = await prisma.businessMembership.findFirst({
    where: { businessId: shareToken.businessId, role: 'OWNER' },
    select: { userId: true },
  });

  if (!owner) {
    return NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 500 });
  }

  // Save file to storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { storageKey, filename, sha } = await saveLocalFile({
    buffer,
    filename: file.name,
    businessId: shareToken.businessId,
    projectId: shareToken.projectId,
  });

  // Create document record
  const created = await prisma.businessDocument.create({
    data: {
      businessId: shareToken.businessId,
      projectId: shareToken.projectId,
      title,
      filename,
      mimeType: mime,
      sizeBytes: buffer.length,
      storageKey,
      sha256: sha,
      kind: DocumentKind.FILE,
      createdByUserId: owner.userId,
    },
  });

  return NextResponse.json(
    {
      id: created.id.toString(),
      title: created.title,
      filename: created.filename,
      mimeType: created.mimeType,
      sizeBytes: created.sizeBytes,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
