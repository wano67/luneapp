import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { jsonNoStore } from '@/server/security/csrf';
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
    return withRequestId(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withRequestId(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    include: { client: true },
  });

  if (!project) {
    return withRequestId(notFound('Projet introuvable.'), requestId);
  }

  return jsonNoStore({ item: serializeProject(project) });
}
