import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import type { Business, BusinessRole } from '@/generated/prisma/client';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { badRequest, getErrorMessage, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function serializeBusiness(b: Business) {
  return {
    id: b.id.toString(),
    name: b.name,
    ownerId: b.ownerId.toString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses
// -> liste des entreprises de l'utilisateur
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  try {
    const memberships = await prisma.businessMembership.findMany({
      where: { userId: BigInt(userId) },
      include: { business: true },
    });

    const items = memberships.map((membership) => ({
      business: serializeBusiness(membership.business as Business),
      role: membership.role,
    }));

    return withRequestId(jsonNoStore({ items }), requestId);
  } catch (error) {
    console.error({ requestId, route: '/api/pro/businesses', error });
    return withRequestId(
      NextResponse.json({ error: 'Impossible de charger les entreprises.' }, { status: 500 }),
      requestId
    );
  }
}

// POST /api/pro/businesses
// -> crée une entreprise et membership OWNER
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:businesses:create:${userId.toString()}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== 'string') {
    return withRequestId(badRequest('Le nom de l’entreprise est requis.'), requestId);
  }

  const name = body.name.trim();

  if (!name) {
    return withRequestId(badRequest('Le nom de l’entreprise ne peut pas être vide.'), requestId);
  }

  try {
    const business = await prisma.business.create({
      data: {
        name,
        ownerId: BigInt(userId),
        memberships: {
          create: {
            userId: BigInt(userId),
            role: 'OWNER' as BusinessRole,
          },
        },
        settings: {
          create: {},
        },
      },
    });

    return withRequestId(
      jsonNoStore(
        {
          business: serializeBusiness(business),
          role: 'OWNER' as BusinessRole,
        },
        { status: 201 }
      ),
      requestId
    );
  } catch (error) {
    console.error({ requestId, route: '/api/pro/businesses', error: getErrorMessage(error) });
    return withRequestId(
      NextResponse.json({ error: 'Impossible de créer l’entreprise.' }, { status: 500 }),
      requestId
    );
  }
}
