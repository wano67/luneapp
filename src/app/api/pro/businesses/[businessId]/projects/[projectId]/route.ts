import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProjectDepositStatus, ProjectQuoteStatus, ProjectStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
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

function serializeProject(project: {
  id: bigint;
  businessId: bigint;
  clientId: bigint | null;
  name: string;
  status: ProjectStatus;
  quoteStatus: ProjectQuoteStatus;
  depositStatus: ProjectDepositStatus;
  startedAt: Date | null;
  archivedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client?: { id: bigint; name: string | null } | null;
  _count?: { tasks: number; projectServices: number; interactions: number };
}) {
  return {
    id: project.id.toString(),
    businessId: project.businessId.toString(),
    clientId: project.clientId ? project.clientId.toString() : null,
    clientName: project.client?.name ?? null,
    client: project.client ? { id: project.client.id.toString(), name: project.client.name } : null,
    name: project.name,
    status: project.status,
    quoteStatus: project.quoteStatus,
    depositStatus: project.depositStatus,
    startedAt: project.startedAt ? project.startedAt.toISOString() : null,
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    endDate: project.endDate ? project.endDate.toISOString() : null,
    counts: project._count
      ? {
          tasks: project._count.tasks,
          projectServices: project._count.projectServices,
          interactions: project._count.interactions,
        }
      : undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function isValidStatus(status: unknown): status is ProjectStatus {
  return typeof status === 'string' && Object.values(ProjectStatus).includes(status as ProjectStatus);
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, projectId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { tasks: true, projectServices: true, interactions: true } },
    },
  });

  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  return withIdNoStore(jsonNoStore({ item: serializeProject(project) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('startedAt' in body || 'archivedAt' in body) {
    return withIdNoStore(badRequest('startedAt/archivedAt ne peuvent pas être modifiés ici.'), requestId);
  }

  if ('name' in body) {
    if (typeof body.name !== 'string') return withIdNoStore(badRequest('Nom invalide.'), requestId);
    const trimmed = body.name.trim();
    if (!trimmed) return withIdNoStore(badRequest('Le nom ne peut pas être vide.'), requestId);
    data.name = trimmed;
  }

  if ('status' in body) {
    if (!isValidStatus(body.status)) {
      return withIdNoStore(badRequest('Statut invalide.'), requestId);
    }
    data.status = body.status as ProjectStatus;
  }

  if ('quoteStatus' in body) {
    const quoteStatus = (body as { quoteStatus?: unknown }).quoteStatus;
    if (
      typeof quoteStatus !== 'string' ||
      !Object.values(ProjectQuoteStatus).includes(quoteStatus as ProjectQuoteStatus)
    ) {
      return withIdNoStore(badRequest('quoteStatus invalide.'), requestId);
    }
    data.quoteStatus = quoteStatus as ProjectQuoteStatus;
  }

  if ('depositStatus' in body) {
    const depositStatus = (body as { depositStatus?: unknown }).depositStatus;
    if (
      typeof depositStatus !== 'string' ||
      !Object.values(ProjectDepositStatus).includes(depositStatus as ProjectDepositStatus)
    ) {
      return withIdNoStore(badRequest('depositStatus invalide.'), requestId);
    }
    data.depositStatus = depositStatus as ProjectDepositStatus;
  }

  if ('clientId' in body) {
    if (body.clientId === null || body.clientId === undefined || body.clientId === '') {
      data.clientId = null;
    } else if (typeof body.clientId === 'string' && /^\d+$/.test(body.clientId)) {
      const clientIdBigInt = BigInt(body.clientId);
      const client = await prisma.client.findFirst({
        where: { id: clientIdBigInt, businessId: businessIdBigInt },
        select: { id: true },
      });
      if (!client) return withIdNoStore(badRequest('clientId invalide pour ce business.'), requestId);
      data.clientId = clientIdBigInt;
    } else {
      return withIdNoStore(badRequest('clientId invalide.'), requestId);
    }
  }

  if ('startDate' in body) {
    if (body.startDate === null || body.startDate === undefined || body.startDate === '') {
      data.startDate = null;
    } else if (typeof body.startDate === 'string') {
      const start = new Date(body.startDate);
      if (Number.isNaN(start.getTime())) return withIdNoStore(badRequest('startDate invalide.'), requestId);
      data.startDate = start;
    } else {
      return withIdNoStore(badRequest('startDate invalide.'), requestId);
    }
  }

  if ('endDate' in body) {
    if (body.endDate === null || body.endDate === undefined || body.endDate === '') {
      data.endDate = null;
    } else if (typeof body.endDate === 'string') {
      const end = new Date(body.endDate);
      if (Number.isNaN(end.getTime())) return withIdNoStore(badRequest('endDate invalide.'), requestId);
      data.endDate = end;
    } else {
      return withIdNoStore(badRequest('endDate invalide.'), requestId);
    }
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.project.update({
    where: { id: projectIdBigInt },
    data,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { tasks: true, projectServices: true, interactions: true } },
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeProject(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  await prisma.project.delete({ where: { id: projectIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
