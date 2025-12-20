import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

type Body = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildName(firstName?: string | null, lastName?: string | null) {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  const full = [f, l].filter(Boolean).join(' ').trim();
  return full || null;
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withRequestId(csrf, requestId);

  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const limited = rateLimit(req, {
    key: `account:profile:${userId}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body: Body = await req.json().catch(() => ({}));
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  if (!emailRaw) return withRequestId(badRequest('Email requis.'), requestId);

  const firstName = typeof body.firstName === 'string' ? body.firstName : null;
  const lastName = typeof body.lastName === 'string' ? body.lastName : null;
  if (firstName && firstName.length > 120) return withRequestId(badRequest('Prénom trop long.'), requestId);
  if (lastName && lastName.length > 120) return withRequestId(badRequest('Nom trop long.'), requestId);

  const email = normalizeEmail(emailRaw);
  try {
    const updated = await prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        email,
        name: buildName(firstName, lastName),
      },
    });

    return withRequestId(
      jsonNoStore({
        user: {
          id: updated.id.toString(),
          email: updated.email,
          name: updated.name,
          updatedAt: updated.updatedAt.toISOString(),
        },
      }),
      requestId
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return withRequestId(NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 }), requestId);
    }
    console.error('account/profile', error);
    return withRequestId(NextResponse.json({ error: 'Impossible de mettre à jour le profil.' }, { status: 500 }), requestId);
  }
}
