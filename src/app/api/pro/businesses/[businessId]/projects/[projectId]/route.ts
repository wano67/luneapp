import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
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
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client?: { name: string | null } | null;
}) {
  return {
    id: project.id.toString(),
    businessId: project.businessId.toString(),
    clientId: project.clientId ? project.clientId.toString() : null,
    clientName: project.client?.name ?? null,
    name: project.name,
    status: project.status,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    endDate: project.endDate ? project.endDate.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function isValidStatus(status: unknown): status is string {
  return (
    status === 'PLANNED' ||
    status === 'ACTIVE' ||
    status === 'ON_HOLD' ||
    status === 'COMPLETED' ||
    status === 'CANCELLED'
  );
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
    include: { client: true },
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
    include: { client: true },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

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
    data.status = body.status;
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
    include: { client: true },
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
