import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { decrypt } from '@/server/crypto/encryption';
import crypto from 'crypto';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/**
 * POST /api/share/[token]/vault — Fetch vault items for a shared project.
 * Separate from the main GET to avoid caching passwords and reduce attack surface.
 * Only returns data when allowVaultAccess=true AND project status=COMPLETED.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:vault'),
    limit: 20,
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
      allowVaultAccess: true,
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

  if (!shareToken.allowVaultAccess) {
    return NextResponse.json({ error: 'Accès au trousseau non autorisé.' }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: shareToken.projectId },
    select: { status: true },
  });

  if (!project || project.status !== 'COMPLETED') {
    return NextResponse.json({ items: [], available: false });
  }

  const rawItems = await prisma.vaultItem.findMany({
    where: { projectId: shareToken.projectId, businessId: shareToken.businessId },
    select: { id: true, title: true, identifier: true, email: true, ciphertext: true, iv: true, tag: true, note: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const items = rawItems.map((v) => {
    let password = '';
    try { password = decrypt(v.ciphertext, v.iv, v.tag); } catch { /* empty */ }
    return {
      id: v.id.toString(),
      title: v.title,
      identifier: v.identifier,
      email: v.email,
      password,
      note: v.note,
      createdAt: v.createdAt.toISOString(),
    };
  });

  return NextResponse.json(
    { items, available: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
