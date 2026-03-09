import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { badRequest, getRequestId, withRequestId } from '@/server/http/apiUtils';
import { isValidEmail, normalizeEmail } from '@/lib/validation/email';
import { buildBaseUrl } from '@/server/http/baseUrl';
import { sendPasswordResetEmail } from '@/server/services/email';

const RESET_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:forgot-password'),
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || !isValidEmail(body.email)) {
    const res = withRequestId(badRequest('Email invalide.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const email = normalizeEmail(body.email);

  // Always return success to prevent email enumeration
  const successResponse = () => {
    const res = NextResponse.json({ ok: true });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return successResponse();
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('base64url');
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + RESET_EXPIRY_HOURS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpiry: expiry,
    },
  });

  const baseUrl = buildBaseUrl(request);
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

  sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetLink,
  }).catch(() => {});

  return successResponse();
}
