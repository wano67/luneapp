import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { badRequest, getRequestId, withRequestId } from '@/server/http/apiUtils';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:reset-password'),
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.token !== 'string' ||
    typeof body.password !== 'string'
  ) {
    const res = withRequestId(badRequest('Token et mot de passe requis.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const rawToken = body.token.trim();
  const password = body.password.trim();

  if (!rawToken) {
    const res = withRequestId(badRequest('Token invalide.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (password.length < 8 || password.length > 128) {
    const res = withRequestId(badRequest('Le mot de passe doit contenir entre 8 et 128 caractères.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    const res = withRequestId(badRequest('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('base64url');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpiry: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!user) {
    const res = NextResponse.json(
      { error: 'Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.' },
      { status: 400 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  // Invalidate all refresh tokens (force re-login on all devices)
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');
  return withRequestId(res, requestId);
}
