import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/server/auth/jwt';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { buildBaseUrl } from '@/server/http/baseUrl';
import { sendVerificationEmail } from '@/server/services/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:resend-verification'),
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const res = NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  let userId: bigint;
  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) throw new Error('no sub');
    userId = BigInt(payload.sub);
  } catch {
    const res = NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    const res = NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  if (user.emailVerified) {
    const res = NextResponse.json({ message: 'Email déjà vérifié.' }, { status: 200 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const rawVerificationToken = crypto.randomBytes(32).toString('base64url');
  const verificationHash = crypto.createHash('sha256').update(rawVerificationToken).digest('base64url');
  const verificationExpiry = new Date();
  verificationExpiry.setHours(verificationExpiry.getHours() + 24);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verificationHash,
      emailVerificationExpiry: verificationExpiry,
    },
  });

  const baseUrl = buildBaseUrl(request);
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(rawVerificationToken)}`;

  sendVerificationEmail({
    to: user.email,
    name: user.name ?? null,
    verificationLink,
  }).catch(() => {});

  const res = NextResponse.json({ message: 'Email de vérification envoyé.' }, { status: 200 });
  res.headers.set('Cache-Control', 'no-store');
  return withRequestId(res, requestId);
}
