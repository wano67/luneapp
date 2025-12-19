import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { InteractionType } from '@/generated/prisma/client';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function withIdNoStore(res: NextResponse, requestId: string) {
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return withRequestId(res, requestId);
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
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const { searchParams } = new URL(request.url);
  const clientId = parseId(searchParams.get('clientId') ?? undefined);
  const projectId = parseId(searchParams.get('projectId') ?? undefined);
  const typeParam = searchParams.get('type')?.trim().toUpperCase() ?? null;
  const allowedTypes: InteractionType[] = ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE'];
  const typeFilter: InteractionType | null =
    typeParam && allowedTypes.includes(typeParam as InteractionType) ? (typeParam as InteractionType) : null;

  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const limitParam = searchParams.get('limit');

  let limit = 50;
  if (limitParam) {
    const parsed = Number(limitParam);
    if (!Number.isFinite(parsed) || parsed < 1) return withIdNoStore(badRequest('limit invalide.'), requestId);
    limit = Math.min(100, Math.max(1, Math.trunc(parsed)));
  }

  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  if (fromStr) {
    const d = new Date(fromStr);
    if (Number.isNaN(d.getTime())) return withIdNoStore(badRequest('from invalide.'), requestId);
    fromDate = d;
  }
  if (toStr) {
    const d = new Date(toStr);
    if (Number.isNaN(d.getTime())) return withIdNoStore(badRequest('to invalide.'), requestId);
    toDate = d;
  }

  const range: { gte?: Date; lte?: Date } = {};
  if (fromDate) range.gte = fromDate;
  if (toDate) range.lte = toDate;

  const interactions = await prisma.interaction.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(fromDate || toDate ? { happenedAt: range } : {}),
    },
    orderBy: [{ happenedAt: 'desc' }],
    take: limit,
  });

  return withIdNoStore(
    jsonNoStore({
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
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/interactions
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:interactions:create:${businessIdBigInt}:${userId}`,
    limit: 300,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const type = typeof body.type === 'string' ? body.type : null;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const happenedAtStr = typeof body.happenedAt === 'string' ? body.happenedAt : null;
  const nextActionStr = typeof body.nextActionDate === 'string' ? body.nextActionDate : null;
  const clientId = parseId(typeof body.clientId === 'string' ? body.clientId : undefined);
  const projectId = parseId(typeof body.projectId === 'string' ? body.projectId : undefined);

  const allowedTypes = ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE'];
  if (!type || !allowedTypes.includes(type)) return withIdNoStore(badRequest('Type invalide.'), requestId);
  if (!content) return withIdNoStore(badRequest('Contenu requis.'), requestId);
  const happenedAt = happenedAtStr ? new Date(happenedAtStr) : new Date();
  if (Number.isNaN(happenedAt.getTime())) return withIdNoStore(badRequest('Date invalide.'), requestId);
  const nextActionDate = nextActionStr ? new Date(nextActionStr) : null;
  if (nextActionDate && Number.isNaN(nextActionDate.getTime())) return withIdNoStore(badRequest('Next action invalide.'), requestId);

  if (!clientId && !projectId) {
    return withIdNoStore(badRequest('clientId ou projectId requis.'), requestId);
  }

  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, businessId: businessIdBigInt } });
    if (!client)
      return withIdNoStore(NextResponse.json({ error: 'Client introuvable.' }, { status: 404 }), requestId);
  }
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, businessId: businessIdBigInt } });
    if (!project)
      return withIdNoStore(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);
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

  return withIdNoStore(
    NextResponse.json(
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
    ),
    requestId
  );
}
