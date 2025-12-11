import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { ProjectStatus } from '@/generated/prisma/client';

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

// GET /api/pro/businesses/{businessId}/projects
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const businessIdBigInt = BigInt(businessId);
  const membership = await requireMembership(businessIdBigInt, userId);
  if (!membership) return forbidden();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as ProjectStatus | null;

  const projects = await prisma.project.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
    },
  });

  return NextResponse.json({
    items: projects.map((p) => ({
      id: p.id.toString(),
      businessId: p.businessId.toString(),
      clientId: p.clientId ? p.clientId.toString() : null,
      clientName: p.client?.name ?? null,
      name: p.name,
      status: p.status,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

// POST /api/pro/businesses/{businessId}/projects
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const businessIdBigInt = BigInt(businessId);
  const membership = await requireMembership(businessIdBigInt, userId);
  if (!membership) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string') {
    return badRequest('Le nom du projet est requis.');
  }

  const name = body.name.trim();
  if (!name) return badRequest('Le nom du projet ne peut pas être vide.');

  let clientId: bigint | undefined;
  if (body.clientId && typeof body.clientId === 'string') {
    clientId = BigInt(body.clientId);
  }

  const status: ProjectStatus =
    typeof body.status === 'string' &&
    ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(
      body.status
    )
      ? (body.status as ProjectStatus)
      : ProjectStatus.PLANNED;

  const project = await prisma.project.create({
    data: {
      businessId: businessIdBigInt,
      clientId,
      name,
      status,
      startDate:
        typeof body.startDate === 'string'
          ? new Date(body.startDate)
          : undefined,
      endDate:
        typeof body.endDate === 'string' ? new Date(body.endDate) : undefined,
    },
  });

  return NextResponse.json(
    {
      id: project.id.toString(),
      businessId: project.businessId.toString(),
      clientId: project.clientId ? project.clientId.toString() : null,
      name: project.name,
      status: project.status,
      startDate: project.startDate ? project.startDate.toISOString() : null,
      endDate: project.endDate ? project.endDate.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
