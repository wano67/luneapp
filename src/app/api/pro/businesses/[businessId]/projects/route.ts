import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProjectStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

// GET /api/pro/businesses/{businessId}/projects
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }
  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withRequestId(forbidden(), requestId);

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

  return jsonNoStore({
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
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withRequestId(badRequest('businessId invalide.'), requestId);
  }
  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:projects:create:${businessIdBigInt}:${userId.toString()}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string') {
    return withRequestId(badRequest('Le nom du projet est requis.'), requestId);
  }

  const name = body.name.trim();
  if (!name) return withRequestId(badRequest('Le nom du projet ne peut pas être vide.'), requestId);

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
