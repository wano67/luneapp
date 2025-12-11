import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getUserId(request: NextRequest): Promise<bigint | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) return null;
    return BigInt(payload.sub);
  } catch {
    return null;
  }
}

async function requireMembership(businessId: bigint, userId: bigint) {
  return prisma.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId, userId },
    },
  });
}

// GET /api/pro/businesses/{businessId}/clients
export async function GET(
  request: NextRequest,
  context: { params: { businessId: string } }
) {
  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const businessId = BigInt(context.params.businessId);
  const membership = await requireMembership(businessId, userId);
  if (!membership) return forbidden();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();

  const clients = await prisma.client.findMany({
    where: {
      businessId,
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    items: clients.map((c) => ({
      id: c.id.toString(),
      businessId: c.businessId.toString(),
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

// POST /api/pro/businesses/{businessId}/clients
export async function POST(
  request: NextRequest,
  context: { params: { businessId: string } }
) {
  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const businessId = BigInt(context.params.businessId);
  const membership = await requireMembership(businessId, userId);
  if (!membership) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string') {
    return badRequest('Le nom du client est requis.');
  }

  const name = body.name.trim();
  if (!name) return badRequest('Le nom du client ne peut pas être vide.');

  const email =
    typeof body.email === 'string' && body.email.trim()
      ? body.email.trim()
      : undefined;
  const phone =
    typeof body.phone === 'string' && body.phone.trim()
      ? body.phone.trim()
      : undefined;
  const notes =
    typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim()
      : undefined;

  const client = await prisma.client.create({
    data: {
      businessId,
      name,
      email,
      phone,
      notes,
    },
  });

  return NextResponse.json(
    {
      id: client.id.toString(),
      businessId: client.businessId.toString(),
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
