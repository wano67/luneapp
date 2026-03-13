import { Prisma } from '@/generated/prisma';
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  createSessionToken,
  createRefreshToken,
  registerUser,
  toPublicUser,
} from '@/server/auth/auth.service';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getRequestId, withRequestId } from '@/server/http/apiUtils';
import { isValidEmail, normalizeEmail } from '@/lib/validation/email';
import { prisma } from '@/server/db/client';
import crypto from 'crypto';
import { buildBaseUrl } from '@/server/http/baseUrl';
import { sendVerificationEmail, sendReferralNotificationEmail } from '@/server/services/email';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:register'),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string'
  ) {
    const res = withRequestId(badRequest('Email et mot de passe sont requis.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const email = normalizeEmail(body.email);
  const password = body.password.trim();
  const name = typeof body.name === 'string' ? body.name : undefined;
  const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken.trim() : null;
  const referralCode = typeof body.referralCode === 'string' ? body.referralCode.trim() : null;
  const acceptedTerms = body.acceptedTerms === true;
  const acceptedPrivacy = body.acceptedPrivacy === true;
  const marketingConsent = body.marketingConsent === true;

  if (!acceptedTerms || !acceptedPrivacy) {
    const res = withRequestId(badRequest('Vous devez accepter les CGV et la politique de confidentialité.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (!isValidEmail(email)) {
    const res = withRequestId(badRequest('Email invalide.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    const res = withRequestId(badRequest('Le mot de passe doit contenir au moins 8 caractères.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    const res = withRequestId(badRequest('Mot de passe trop long.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    const res = withRequestId(badRequest('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  try {
    const user = await registerUser({ email, password, name });

    // Generate email verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('base64url');
    const verificationHash = crypto.createHash('sha256').update(rawVerificationToken).digest('base64url');
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24);

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationHash,
        emailVerificationExpiry: verificationExpiry,
        acceptedTermsAt: now,
        acceptedPrivacyAt: now,
        ...(marketingConsent ? { marketingConsentAt: now } : {}),
        ...(inviteToken ? { pendingInviteToken: inviteToken } : {}),
      },
    });

    // Link referral if a valid referral code was provided
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true, name: true, email: true },
      });
      if (referrer && referrer.id !== user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { referredById: referrer.id },
        });
        // Notify the referrer
        sendReferralNotificationEmail({
          to: referrer.email,
          referrerName: referrer.name ?? 'Utilisateur',
          refereeName: name ?? email,
        }).catch(() => {});
      }
    }

    const baseUrl = buildBaseUrl(request);
    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(rawVerificationToken)}`;

    sendVerificationEmail({
      to: email,
      name: user.name ?? null,
      verificationLink,
    }).catch(() => {});

    const [sessionToken, refreshRaw] = await Promise.all([
      createSessionToken(user),
      createRefreshToken(user.id),
    ]);
    const response = NextResponse.json(
      { user: toPublicUser(user) },
      { status: 201 }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      ...authCookieOptions,
    });
    response.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: refreshRaw,
      ...refreshCookieOptions,
    });

    response.headers.set('Cache-Control', 'no-store');
    return withRequestId(response, requestId);
  } catch (error: unknown) {
    if (isPrismaKnownError(error) && error.code === 'P2002') {
      // Email already used — non-enumerable: always return same generic message
      const res = NextResponse.json(
        { error: 'Un compte avec cet email existe déjà. Connectez-vous ou réinitialisez votre mot de passe.' },
        { status: 409 }
      );
      res.headers.set('Cache-Control', 'no-store');
      return withRequestId(res, requestId);
    }

    console.error('[auth] Registration error');

    const res = NextResponse.json({ error: 'Impossible de créer le compte pour le moment.' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }
}

function isPrismaKnownError(error: unknown): error is PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
