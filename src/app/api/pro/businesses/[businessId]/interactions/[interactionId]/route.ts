import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

async function getInteraction(businessId: bigint, interactionId: bigint) {
  return prisma.interaction.findFirst({
    where: { id: interactionId, businessId },
  });
}

// PATCH /api/pro/businesses/{businessId}/interactions/{interactionId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; interactionId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, interactionId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const interactionIdBigInt = parseId(interactionId);
  if (!businessIdBigInt || !interactionIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const existing = await getInteraction(businessIdBigInt, interactionIdBigInt);
  if (!existing) {
    return withRequestId(NextResponse.json({ error: 'Interaction introuvable.' }, { status: 404 }), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withRequestId(badRequest('Payload invalide.'), requestId);

  const type = typeof body.type === 'string' ? body.type : null;
  const content = typeof body.content === 'string' ? body.content.trim() : undefined;
  const happenedAtStr = typeof body.happenedAt === 'string' ? body.happenedAt : null;
  const nextActionStr = typeof body.nextActionDate === 'string' ? body.nextActionDate : null;

  if (content !== undefined && !content) return withRequestId(badRequest('Contenu requis.'), requestId);
  const data: {
    type?: 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE';
    content?: string;
    happenedAt?: Date;
    nextActionDate?: Date | null;
  } = {};
  if (type) {
    const allowed = ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE'];
    if (!allowed.includes(type)) return withRequestId(badRequest('Type invalide.'), requestId);
    data.type = type as 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE';
  }
  if (content !== undefined) data.content = content;
  if (happenedAtStr) {
    const d = new Date(happenedAtStr);
    if (Number.isNaN(d.getTime())) return withRequestId(badRequest('Date invalide.'), requestId);
    data.happenedAt = d;
  }
  if (nextActionStr) {
    const d = new Date(nextActionStr);
    if (Number.isNaN(d.getTime())) return withRequestId(badRequest('Next action invalide.'), requestId);
    data.nextActionDate = d;
  } else if (nextActionStr === null) {
    data.nextActionDate = null;
  }

  const updated = await prisma.interaction.update({
    where: { id: interactionIdBigInt },
    data,
  });

  return jsonNoStore({
    id: updated.id.toString(),
    businessId: updated.businessId.toString(),
    clientId: updated.clientId ? updated.clientId.toString() : null,
    projectId: updated.projectId ? updated.projectId.toString() : null,
    type: updated.type,
    content: updated.content,
    happenedAt: updated.happenedAt.toISOString(),
    nextActionDate: updated.nextActionDate ? updated.nextActionDate.toISOString() : null,
    createdByUserId: updated.createdByUserId ? updated.createdByUserId.toString() : null,
    createdAt: updated.createdAt.toISOString(),
  });
}

// DELETE /api/pro/businesses/{businessId}/interactions/{interactionId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; interactionId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, interactionId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const interactionIdBigInt = parseId(interactionId);
  if (!businessIdBigInt || !interactionIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const existing = await getInteraction(businessIdBigInt, interactionIdBigInt);
  if (!existing) {
    return withRequestId(NextResponse.json({ error: 'Interaction introuvable.' }, { status: 404 }), requestId);
  }

  await prisma.interaction.delete({ where: { id: interactionIdBigInt } });
  return jsonNoStore({ ok: true });
}
