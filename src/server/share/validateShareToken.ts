import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export function hashShareToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

export type ValidatedShareToken = {
  projectId: bigint;
  businessId: bigint;
  allowClientUpload: boolean;
  allowVaultAccess: boolean;
  passwordHash: string | null;
};

/**
 * Validate a raw share token from the URL.
 * Returns the token record or a NextResponse error.
 * Does NOT check password session — callers must do that separately.
 */
export async function validateShareToken(
  rawToken: string
): Promise<{ ok: true; token: ValidatedShareToken } | { ok: false; response: NextResponse }> {
  if (!rawToken?.trim()) {
    return { ok: false, response: NextResponse.json({ error: 'Token requis.' }, { status: 400 }) };
  }

  const tokenHash = hashShareToken(rawToken.trim());

  const shareToken = await prisma.projectShareToken.findUnique({
    where: { token: tokenHash },
    select: {
      projectId: true,
      businessId: true,
      allowClientUpload: true,
      allowVaultAccess: true,
      passwordHash: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!shareToken) {
    return { ok: false, response: NextResponse.json({ error: 'Lien de partage invalide.' }, { status: 404 }) };
  }

  if (shareToken.revokedAt) {
    return { ok: false, response: NextResponse.json({ error: 'Ce lien a \u00e9t\u00e9 r\u00e9voqu\u00e9.' }, { status: 410 }) };
  }

  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    return { ok: false, response: NextResponse.json({ error: 'Ce lien a expir\u00e9.' }, { status: 410 }) };
  }

  return { ok: true, token: shareToken };
}
