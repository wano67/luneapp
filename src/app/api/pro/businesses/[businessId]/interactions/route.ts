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

// GET /api/pro/businesses/{businessId}/interactions
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden();

  const { searchParams } = new URL(request.url);
  const clientId = parseId(searchParams.get('clientId') ?? undefined);
  const projectId = parseId(searchParams.get('projectId') ?? undefined);

  const interactions = await prisma.interaction.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ happenedAt: 'desc' }],
  });

  return jsonNoStore({
    items: interactions.map((i) => ({
      id: i.id.toString(),
      businessId: i.businessId.toString(),
      clientId: i.clientId ? i.clientId.toString() : null,
      projectId: i.projectId ? i.projectId.toString() : null,
      type: i.type,
      content: i.content,
      happenedAt: i.happenedAt.toISOString(),
      nextActionDate: i.nextActionDate ? i.nextActionDate.toISOString() : null,
      createdByUserId: i.createdByUserId ? i.createdByUserId.toString() : null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

// POST /api/pro/businesses/{businessId}/interactions
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
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

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withRequestId(badRequest('Payload invalide.'), requestId);

  const type = typeof body.type === 'string' ? body.type : null;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const happenedAtStr = typeof body.happenedAt === 'string' ? body.happenedAt : null;
  const nextActionStr = typeof body.nextActionDate === 'string' ? body.nextActionDate : null;
  const clientId = parseId(typeof body.clientId === 'string' ? body.clientId : undefined);
  const projectId = parseId(typeof body.projectId === 'string' ? body.projectId : undefined);

  if (!type) return withRequestId(badRequest('Type requis.'), requestId);
  if (!content) return withRequestId(badRequest('Contenu requis.'), requestId);
  const happenedAt = happenedAtStr ? new Date(happenedAtStr) : new Date();
  if (Number.isNaN(happenedAt.getTime())) return withRequestId(badRequest('Date invalide.'), requestId);
  const nextActionDate = nextActionStr ? new Date(nextActionStr) : null;
  if (nextActionDate && Number.isNaN(nextActionDate.getTime())) return withRequestId(badRequest('Next action invalide.'), requestId);

  if (!clientId && !projectId) {
    return withRequestId(badRequest('clientId ou projectId requis.'), requestId);
  }

  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, businessId: businessIdBigInt } });
    if (!client) return withRequestId(NextResponse.json({ error: 'Client introuvable.' }, { status: 404 }), requestId);
  }
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, businessId: businessIdBigInt } });
    if (!project) return withRequestId(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);
  }

  const created = await prisma.interaction.create({
    data: {
      businessId: businessIdBigInt,
      clientId: clientId ?? undefined,
      projectId: projectId ?? undefined,
      type: type as 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE',
      content,
      happenedAt,
      nextActionDate: nextActionDate ?? undefined,
      createdByUserId: BigInt(userId),
    },
  });

  return NextResponse.json(
    {
      id: created.id.toString(),
      businessId: created.businessId.toString(),
      clientId: created.clientId ? created.clientId.toString() : null,
      projectId: created.projectId ? created.projectId.toString() : null,
      type: created.type,
      content: created.content,
      happenedAt: created.happenedAt.toISOString(),
      nextActionDate: created.nextActionDate ? created.nextActionDate.toISOString() : null,
      createdByUserId: created.createdByUserId ? created.createdByUserId.toString() : null,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
