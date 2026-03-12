import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import bcrypt from 'bcryptjs';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '@/server/auth/auth.service';
import { requireAuthBase } from '@/server/auth/requireAuthBase';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { getRequestId, withRequestId, unauthorized, badRequest } from '@/server/http/apiUtils';
import { decrypt } from '@/server/crypto/encryption';
import { powensDeleteUser } from '@/server/services/powens';

/**
 * DELETE /api/auth/account — Suppression définitive du compte utilisateur.
 *
 * Requiert la confirmation du mot de passe.
 * Bloque si l'utilisateur est OWNER d'un business avec d'autres membres.
 */
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);

  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:delete-account'),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: bigint;
  try {
    const auth = await requireAuthBase(request);
    userId = BigInt(auth.userId);
  } catch {
    const res = withRequestId(unauthorized(), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof (body as Record<string, unknown>).password !== 'string') {
    const res = withRequestId(badRequest('Mot de passe requis pour confirmer la suppression.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const password = ((body as Record<string, unknown>).password as string).trim();
  if (!password) {
    const res = withRequestId(badRequest('Mot de passe requis.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // Fetch user
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const res = withRequestId(unauthorized(), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    const res = NextResponse.json(
      { error: 'Mot de passe incorrect.' },
      { status: 403 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  // Check if user owns businesses with other members
  const ownedWithMembers = await prisma.business.findFirst({
    where: {
      ownerId: userId,
      memberships: { some: { userId: { not: userId } } },
    },
    select: { id: true, name: true },
  });

  if (ownedWithMembers) {
    const res = NextResponse.json(
      {
        error: `Vous êtes propriétaire de « ${ownedWithMembers.name} » qui a d'autres membres. Transférez la propriété ou supprimez l'entreprise avant de supprimer votre compte.`,
        code: 'OWNS_BUSINESS_WITH_MEMBERS',
      },
      { status: 409 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  // Delete Powens user if connected (best-effort, before transaction)
  try {
    const powensConn = await prisma.powensConnection.findUnique({
      where: { userId },
    });
    if (powensConn) {
      const authToken = decrypt(powensConn.authTokenCipher, powensConn.authTokenIv, powensConn.authTokenTag);
      await powensDeleteUser(authToken).catch(() => {});
    }
  } catch {
    // Non-blocking: Powens cleanup is best-effort
  }

  // Delete account in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Delete owned businesses (cascade cleans up all business data)
      const ownedBusinesses = await tx.business.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      for (const biz of ownedBusinesses) {
        await tx.business.delete({ where: { id: biz.id } });
      }

      // Reassign Restrict foreign keys to avoid blocking deletion
      // (invoices/quotes/documents created by this user in OTHER businesses)
      const memberBusinessIds = (
        await tx.businessMembership.findMany({
          where: { userId },
          select: { businessId: true, business: { select: { ownerId: true } } },
        })
      ).filter((m) => m.business.ownerId !== userId);

      for (const m of memberBusinessIds) {
        const ownerId = m.business.ownerId;
        await tx.invoice.updateMany({
          where: { createdByUserId: userId, businessId: m.businessId },
          data: { createdByUserId: ownerId },
        });
        await tx.quote.updateMany({
          where: { createdByUserId: userId, businessId: m.businessId },
          data: { createdByUserId: ownerId },
        });
      }

      // Remove memberships from businesses user doesn't own
      await tx.businessMembership.deleteMany({ where: { userId } });

      // Delete user (cascade handles: refreshTokens, personalAccounts, personalTransactions,
      // personalCategories, personalBudgets, savingsGoals, personalSubscriptions,
      // notifications, notificationPreferences, taskAssignees, conversations, etc.)
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (err) {
    console.error('[auth] Account deletion failed:', err instanceof Error ? err.message : 'unknown');
    const res = NextResponse.json(
      { error: 'Impossible de supprimer le compte. Certaines données sont liées à des entreprises.' },
      { status: 500 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  // Clear cookies
  const response = NextResponse.json({ deleted: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    ...authCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: '',
    ...refreshCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set('Cache-Control', 'no-store');
  return withRequestId(response, requestId);
}
