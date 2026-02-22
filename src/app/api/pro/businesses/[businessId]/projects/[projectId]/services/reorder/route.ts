import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, forbidden, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

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

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}/services/reorder
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
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:reorder:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const itemsRaw = (body as { items?: unknown }).items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return withIdNoStore(badRequest('items invalide.'), requestId);
  }

  const updates: Array<{ id: bigint; position: number }> = [];
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== 'object') return withIdNoStore(badRequest('items invalide.'), requestId);
    const idRaw = (raw as { id?: unknown }).id;
    const posRaw = (raw as { position?: unknown }).position;
    if (typeof idRaw !== 'string' || !/^\d+$/.test(idRaw)) {
      return withIdNoStore(badRequest('item.id invalide.'), requestId);
    }
    if (typeof posRaw !== 'number' || !Number.isFinite(posRaw)) {
      return withIdNoStore(badRequest('item.position invalide.'), requestId);
    }
    const position = Math.max(0, Math.trunc(posRaw));
    updates.push({ id: BigInt(idRaw), position });
  }

  const existing = await prisma.projectService.findMany({
    where: { projectId: projectIdBigInt, project: { businessId: businessIdBigInt }, id: { in: updates.map((u) => u.id) } },
    select: { id: true },
  });
  if (existing.length !== updates.length) {
    return withIdNoStore(badRequest('Services introuvables pour ce projet.'), requestId);
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.projectService.update({
        where: { id: u.id },
        data: { position: u.position },
      })
    )
  );

  return withIdNoStore(jsonNoStore({ ok: true }), requestId);
}
