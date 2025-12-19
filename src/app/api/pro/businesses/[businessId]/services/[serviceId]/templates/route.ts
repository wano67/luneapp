import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { TaskPhase } from '@/generated/prisma/client';

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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function normalizeStr(value: unknown) {
  return String(value ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

type TemplateInput = {
  title: string;
  phase: TaskPhase | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

function validateTemplateBody(body: unknown): TemplateInput | { error: string } {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const title = normalizeStr(body.title);
  if (!title || title.length < 1) return { error: 'Titre requis (1-120).' };
  if (title.length > 120) return { error: 'Titre trop long (120 max).' };

  const phaseRaw = typeof body.phase === 'string' ? body.phase : null;
  const phase =
    phaseRaw && Object.values(TaskPhase).includes(phaseRaw as TaskPhase)
      ? (phaseRaw as TaskPhase)
      : null;

  const roleRaw = normalizeStr(body.defaultAssigneeRole);
  const defaultAssigneeRole = roleRaw ? roleRaw : null;
  if (defaultAssigneeRole && defaultAssigneeRole.length > 60) {
    return { error: 'Rôle assigné trop long (60 max).' };
  }

  let defaultDueOffsetDays: number | null = null;
  if (body.defaultDueOffsetDays !== undefined) {
    if (body.defaultDueOffsetDays === null) {
      defaultDueOffsetDays = null;
    } else if (typeof body.defaultDueOffsetDays === 'number' && Number.isFinite(body.defaultDueOffsetDays)) {
      defaultDueOffsetDays = Math.trunc(body.defaultDueOffsetDays);
      if (defaultDueOffsetDays < 0 || defaultDueOffsetDays > 365) {
        return { error: 'Offset jours doit être entre 0 et 365.' };
      }
    } else {
      return { error: 'Offset jours invalide.' };
    }
  }

  return {
    title,
    phase,
    defaultAssigneeRole,
    defaultDueOffsetDays,
  };
}

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { id: true },
  });
}

function serializeTemplate(tpl: {
  id: bigint;
  serviceId: bigint;
  phase: TaskPhase | null;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
  createdAt: Date;
  defaultAssigneeRoleNullable?: string | null;
}) {
  return {
    id: tpl.id.toString(),
    serviceId: tpl.serviceId.toString(),
    phase: tpl.phase,
    title: tpl.title,
    defaultAssigneeRole: tpl.defaultAssigneeRole,
    defaultDueOffsetDays: tpl.defaultDueOffsetDays,
    createdAt: tpl.createdAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/services/{serviceId}/templates
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) {
    return withIdNoStore(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  const templates = await prisma.serviceTaskTemplate.findMany({
    where: { serviceId: serviceIdBigInt, service: { businessId: businessIdBigInt } },
    orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }],
  });

  return withIdNoStore(
    jsonNoStore({
      items: templates.map(serializeTemplate),
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/services/{serviceId}/templates
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
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

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) {
    return withIdNoStore(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:services:templates:create:${businessIdBigInt}:${serviceIdBigInt}:${userId}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  const parsed = validateTemplateBody(body);
  if ('error' in parsed) return withIdNoStore(badRequest(parsed.error), requestId);

  const duplicate = await prisma.serviceTaskTemplate.findFirst({
    where: {
      serviceId: serviceIdBigInt,
      service: { businessId: businessIdBigInt },
      title: parsed.title,
      phase: parsed.phase ?? null,
    },
  });
  if (duplicate) {
    return withIdNoStore(badRequest('Un template avec ce titre et cette phase existe déjà.'), requestId);
  }

  const created = await prisma.serviceTaskTemplate.create({
    data: {
      serviceId: serviceIdBigInt,
      phase: parsed.phase ?? undefined,
      title: parsed.title,
      defaultAssigneeRole: parsed.defaultAssigneeRole ?? undefined,
      defaultDueOffsetDays: parsed.defaultDueOffsetDays ?? undefined,
    },
  });

  return withIdNoStore(
    NextResponse.json(serializeTemplate(created), { status: 201 }),
    requestId
  );
}
