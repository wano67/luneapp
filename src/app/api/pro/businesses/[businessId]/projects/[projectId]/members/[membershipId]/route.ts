import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}/members/{membershipId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; membershipId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, projectId, membershipId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const membershipIdBigInt = parseId(membershipId);
  if (!businessIdBigInt || !projectIdBigInt || !membershipIdBigInt) {
    return withIdNoStore(badRequest('Paramètres invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!project) return withIdNoStore(notFound('Projet introuvable.'), requestId);

  const targetMembership = await prisma.businessMembership.findFirst({
    where: { id: membershipIdBigInt, businessId: businessIdBigInt },
    select: { role: true },
  });
  if (!targetMembership) return withIdNoStore(notFound('Membre introuvable.'), requestId);
  if (targetMembership.role === 'OWNER' || targetMembership.role === 'ADMIN') {
    return withIdNoStore(badRequest('Accès implicite pour les admins/owners.'), requestId);
  }

  const existing = await prisma.projectMember.findFirst({
    where: { projectId: projectIdBigInt, membershipId: membershipIdBigInt },
    select: { id: true },
  });
  if (!existing) return withIdNoStore(notFound('Accès introuvable.'), requestId);

  await prisma.projectMember.delete({ where: { id: existing.id } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
