import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import type { Business, BusinessRole } from '@/generated/prisma/client';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serializeBusiness(b: Business) {
  return {
    id: b.id.toString(),
    name: b.name,
    ownerId: b.ownerId.toString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

async function getAuthenticatedUserId(request: NextRequest): Promise<bigint | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) return null;
    return BigInt(payload.sub);
  } catch (error) {
    console.error('Error verifying auth token in /api/pro/businesses', error);
    return null;
  }
}

// GET /api/pro/businesses
// -> liste des entreprises de l'utilisateur
export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return unauthorized();

  try {
    const memberships = await prisma.businessMembership.findMany({
      where: { userId },
      include: { business: true },
    });

    const items = memberships.map((membership) => ({
      business: serializeBusiness(membership.business as Business),
      role: membership.role,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/pro/businesses', error);
    return NextResponse.json(
      { error: 'Impossible de charger les entreprises.' },
      { status: 500 }
    );
  }
}

// POST /api/pro/businesses
// -> crée une entreprise et membership OWNER
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== 'string') {
    return badRequest('Le nom de l’entreprise est requis.');
  }

  const name = body.name.trim();

  if (!name) {
    return badRequest('Le nom de l’entreprise ne peut pas être vide.');
  }

  try {
    const business = await prisma.business.create({
      data: {
        name,
        ownerId: userId,
        memberships: {
          create: {
            userId,
            role: 'OWNER' as BusinessRole,
          },
        },
      },
    });

    return NextResponse.json(
      {
        business: serializeBusiness(business),
        role: 'OWNER' as BusinessRole,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/pro/businesses', error);
    return NextResponse.json(
      { error: 'Impossible de créer l’entreprise.' },
      { status: 500 }
    );
  }
}
