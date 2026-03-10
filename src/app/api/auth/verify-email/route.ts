import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSessionToken,
  toPublicUser,
} from '@/server/auth/auth.service';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { buildBaseUrl } from '@/server/http/baseUrl';
import crypto from 'crypto';

// No CSRF: the one-time token IS the proof of ownership.

// GET /api/auth/verify-email?token=xxx — user clicks the email link
export async function GET(request: NextRequest) {
  const _requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:verify-email'),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const rawToken = request.nextUrl.searchParams.get('token')?.trim();
  if (!rawToken) {
    return NextResponse.redirect(new URL('/verify-email', buildBaseUrl(request)));
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('base64url');

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    // Check if token exists but expired
    const expiredUser = await prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
    });
    const errorParam = expiredUser ? 'expired' : 'invalid';
    return NextResponse.redirect(new URL(`/verify-email?error=${errorParam}`, buildBaseUrl(request)));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      pendingInviteToken: null,
    },
  });

  // Auto-accept pending business invite if present
  let acceptedBusinessId: bigint | null = null;

  if (user.pendingInviteToken) {
    const invite = await prisma.businessInvite.findFirst({
      where: { token: user.pendingInviteToken, status: 'PENDING' },
      include: { business: { select: { id: true } } },
    });

    if (
      invite &&
      invite.email.toLowerCase() === user.email.toLowerCase() &&
      (!invite.expiresAt || invite.expiresAt > new Date())
    ) {
      const alreadyMember = await prisma.businessMembership.findUnique({
        where: { businessId_userId: { businessId: invite.businessId, userId: user.id } },
      });
      if (!alreadyMember) {
        await prisma.$transaction(async (tx) => {
          await tx.businessMembership.create({
            data: { businessId: invite.businessId, userId: user.id, role: invite.role },
          });
          await tx.businessInvite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED' },
          });
        });
        acceptedBusinessId = invite.businessId;
      }
    }
  }

  const updatedUser = { ...user, emailVerified: true };
  const sessionToken = await createSessionToken(updatedUser);

  const redirectTarget = acceptedBusinessId
    ? `/app/pro/${acceptedBusinessId}`
    : '/verify-email?verified=true';

  const response = NextResponse.redirect(new URL(redirectTarget, buildBaseUrl(request)));
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: sessionToken,
    ...authCookieOptions,
  });

  return response;
}

// POST /api/auth/verify-email — fallback from frontend
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:verify-email'),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof (body as Record<string, unknown>).token !== 'string') {
    const res = NextResponse.json({ error: 'Token requis.' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const rawToken = ((body as Record<string, unknown>).token as string).trim();
  if (!rawToken) {
    const res = NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('base64url');

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    const res = NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 400 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      pendingInviteToken: null,
    },
  });

  // Auto-accept pending business invite if present
  let acceptedBusinessId: string | null = null;

  if (user.pendingInviteToken) {
    const invite = await prisma.businessInvite.findFirst({
      where: { token: user.pendingInviteToken, status: 'PENDING' },
      include: { business: { select: { id: true } } },
    });

    if (
      invite &&
      invite.email.toLowerCase() === user.email.toLowerCase() &&
      (!invite.expiresAt || invite.expiresAt > new Date())
    ) {
      const alreadyMember = await prisma.businessMembership.findUnique({
        where: { businessId_userId: { businessId: invite.businessId, userId: user.id } },
      });
      if (!alreadyMember) {
        await prisma.$transaction(async (tx) => {
          await tx.businessMembership.create({
            data: { businessId: invite.businessId, userId: user.id, role: invite.role },
          });
          await tx.businessInvite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED' },
          });
        });
        acceptedBusinessId = invite.businessId.toString();
      }
    }
  }

  const updatedUser = { ...user, emailVerified: true };
  const sessionToken = await createSessionToken(updatedUser);

  const response = NextResponse.json(
    { user: toPublicUser(updatedUser), verified: true, acceptedBusinessId },
    { status: 200 }
  );

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: sessionToken,
    ...authCookieOptions,
  });

  response.headers.set('Cache-Control', 'no-store');
  return withRequestId(response, requestId);
}
