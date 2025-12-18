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

// GET /api/pro/businesses/{businessId}/projects/{projectId}/services
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) return withRequestId(badRequest('Ids invalides.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden();

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
  });
  if (!project) return withRequestId(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);

  const items = await prisma.projectService.findMany({
    where: { projectId: projectIdBigInt },
    include: { service: true },
    orderBy: { createdAt: 'desc' },
  });

  return jsonNoStore({
    items: items.map((it) => ({
      id: it.id.toString(),
      projectId: it.projectId.toString(),
      serviceId: it.serviceId.toString(),
      quantity: it.quantity,
      priceCents: it.priceCents?.toString() ?? null,
      notes: it.notes,
      createdAt: it.createdAt.toISOString(),
      service: {
        id: it.service.id.toString(),
        code: it.service.code,
        name: it.service.name,
        type: it.service.type,
      },
    })),
  });
}

// POST /api/pro/businesses/{businessId}/projects/{projectId}/services
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
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

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) return withRequestId(badRequest('Ids invalides.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
  });
  if (!project) return withRequestId(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withRequestId(badRequest('Payload invalide.'), requestId);
  const serviceIdBigInt = parseId(typeof body.serviceId === 'string' ? body.serviceId : undefined);
  if (!serviceIdBigInt) return withRequestId(badRequest('serviceId invalide.'), requestId);

  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? Math.max(1, Math.trunc(body.quantity)) : 1;
  const priceCents =
    typeof body.priceCents === 'number' && Number.isFinite(body.priceCents)
      ? Math.max(0, Math.trunc(body.priceCents))
      : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
  if (notes && notes.length > 2000) return withRequestId(badRequest('Notes trop longues.'), requestId);

  const service = await prisma.service.findFirst({
    where: { id: serviceIdBigInt, businessId: businessIdBigInt },
  });
  if (!service) return withRequestId(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);

  const created = await prisma.projectService.create({
    data: {
      projectId: projectIdBigInt,
      serviceId: serviceIdBigInt,
      quantity,
      priceCents: priceCents ?? undefined,
      notes: notes || undefined,
    },
    include: { service: true },
  });

  return NextResponse.json(
    {
      id: created.id.toString(),
      projectId: created.projectId.toString(),
      serviceId: created.serviceId.toString(),
      quantity: created.quantity,
      priceCents: created.priceCents?.toString() ?? null,
      notes: created.notes,
      createdAt: created.createdAt.toISOString(),
      service: {
        id: created.service.id.toString(),
        code: created.service.code,
        name: created.service.name,
        type: created.service.type,
      },
    },
    { status: 201 }
  );
}
