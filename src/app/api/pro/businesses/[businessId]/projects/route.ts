import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProjectStatus, ProjectQuoteStatus, ProjectDepositStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
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
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }
  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);
  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const status =
    statusParam && Object.values(ProjectStatus).includes(statusParam as ProjectStatus)
      ? (statusParam as ProjectStatus)
      : null;
  const archivedParam = searchParams.get('archived');
  const clientIdParam = searchParams.get('clientId');
  const q = searchParams.get('q')?.trim();

  const archivedFilter =
    archivedParam === 'true' ? { archivedAt: { not: null } } : archivedParam === 'false' ? { archivedAt: null } : {};
  const clientId =
    clientIdParam && /^\d+$/.test(clientIdParam) ? BigInt(clientIdParam) : null;

  const projects = await prisma.project.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
      ...archivedFilter,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  return withIdNoStore(
    jsonNoStore({
      items: projects.map((p) => ({
        id: p.id.toString(),
        businessId: p.businessId.toString(),
        clientId: p.clientId ? p.clientId.toString() : null,
        clientName: p.client?.name ?? null,
        name: p.name,
        status: p.status,
        quoteStatus: p.quoteStatus,
        depositStatus: p.depositStatus,
        startedAt: p.startedAt ? p.startedAt.toISOString() : null,
        archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/projects
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }
  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);
  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:projects:create:${businessIdBigInt}:${userId.toString()}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string') {
    return withIdNoStore(badRequest('Le nom du projet est requis.'), requestId);
  }

  const name = body.name.trim();
  if (!name) return withIdNoStore(badRequest('Le nom du projet ne peut pas être vide.'), requestId);

  let clientId: bigint | undefined;
  if (body.clientId && typeof body.clientId === 'string') {
    clientId = BigInt(body.clientId);
  }
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!client) {
      return withIdNoStore(badRequest('clientId invalide pour ce business.'), requestId);
    }
  }

  const status: ProjectStatus =
    typeof body.status === 'string' && Object.values(ProjectStatus).includes(body.status as ProjectStatus)
      ? (body.status as ProjectStatus)
      : ProjectStatus.PLANNED;
  const quoteStatus: ProjectQuoteStatus =
    typeof body.quoteStatus === 'string' && Object.values(ProjectQuoteStatus).includes(body.quoteStatus as ProjectQuoteStatus)
      ? (body.quoteStatus as ProjectQuoteStatus)
      : ProjectQuoteStatus.DRAFT;
  const depositStatus: ProjectDepositStatus =
    typeof body.depositStatus === 'string' && Object.values(ProjectDepositStatus).includes(body.depositStatus as ProjectDepositStatus)
      ? (body.depositStatus as ProjectDepositStatus)
      : ProjectDepositStatus.PENDING;

  const project = await prisma.project.create({
    data: {
      businessId: businessIdBigInt,
      clientId,
      name,
      status,
      quoteStatus,
      depositStatus,
      startDate:
        typeof body.startDate === 'string'
          ? new Date(body.startDate)
          : undefined,
      endDate:
        typeof body.endDate === 'string' ? new Date(body.endDate) : undefined,
    },
  });

  return withIdNoStore(
    jsonNoStore(
      {
        id: project.id.toString(),
        businessId: project.businessId.toString(),
        clientId: project.clientId ? project.clientId.toString() : null,
        name: project.name,
        status: project.status,
        quoteStatus: project.quoteStatus,
        depositStatus: project.depositStatus,
        startedAt: project.startedAt ? project.startedAt.toISOString() : null,
        archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
        startDate: project.startDate ? project.startDate.toISOString() : null,
        endDate: project.endDate ? project.endDate.toISOString() : null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      { status: 201 }
    ),
    requestId
  );
}
