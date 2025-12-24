import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { TaskPhase } from '@/generated/prisma/client';

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

function forbidden(requestId: string) {
  return withIdNoStore(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), requestId);
}

function normalizeStr(value: unknown) {
  return String(value ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

type TemplateUpdate = {
  title?: string;
  phase?: TaskPhase | null;
  defaultAssigneeRole?: string | null;
  defaultDueOffsetDays?: number | null;
};

function validateUpdate(body: unknown): TemplateUpdate | { error: string } {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const updates: TemplateUpdate = {};

  if ('title' in body) {
    const title = normalizeStr(body.title);
    if (!title || title.length < 1) return { error: 'Titre requis (1-120).' };
    if (title.length > 120) return { error: 'Titre trop long (120 max).' };
    updates.title = title;
  }

  if ('phase' in body) {
    const raw = typeof body.phase === 'string' ? body.phase : null;
    updates.phase =
      raw && Object.values(TaskPhase).includes(raw as TaskPhase) ? (raw as TaskPhase) : null;
  }

  if ('defaultAssigneeRole' in body) {
    const role = normalizeStr(body.defaultAssigneeRole);
    if (role && role.length > 60) return { error: 'Rôle assigné trop long (60 max).' };
    updates.defaultAssigneeRole = role ? role : null;
  }

  if ('defaultDueOffsetDays' in body) {
    if (body.defaultDueOffsetDays === null) {
      updates.defaultDueOffsetDays = null;
    } else if (typeof body.defaultDueOffsetDays === 'number' && Number.isFinite(body.defaultDueOffsetDays)) {
      const value = Math.trunc(body.defaultDueOffsetDays);
      if (value < 0 || value > 365) return { error: 'Offset jours doit être entre 0 et 365.' };
      updates.defaultDueOffsetDays = value;
    } else {
      return { error: 'Offset jours invalide.' };
    }
  }

  if (
    !('title' in updates) &&
    !('phase' in updates) &&
    !('defaultAssigneeRole' in updates) &&
    !('defaultDueOffsetDays' in updates)
  ) {
    return { error: 'Aucune mise à jour fournie.' };
  }

  return updates;
}

async function getTemplate(businessId: bigint, serviceId: bigint, templateId: bigint) {
  return prisma.serviceTaskTemplate.findFirst({
    where: { id: templateId, serviceId, service: { businessId } },
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

// PATCH /api/pro/businesses/{businessId}/services/{serviceId}/templates/{templateId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string; templateId: string }> }
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

  const { businessId, serviceId, templateId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  const templateIdBigInt = parseId(templateId);
  if (!businessIdBigInt || !serviceIdBigInt || !templateIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const existing = await getTemplate(businessIdBigInt, serviceIdBigInt, templateIdBigInt);
  if (!existing) {
    return withIdNoStore(NextResponse.json({ error: 'Template introuvable.' }, { status: 404 }), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:services:templates:update:${businessIdBigInt}:${serviceIdBigInt}:${templateIdBigInt}`,
    limit: 300,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  const updates = validateUpdate(body);
  if ('error' in updates) return withIdNoStore(badRequest(updates.error), requestId);

  const nextTitle = 'title' in updates ? updates.title ?? existing.title : existing.title;
  const nextPhase = 'phase' in updates ? updates.phase : existing.phase;

  if ('title' in updates || 'phase' in updates) {
    const duplicate = await prisma.serviceTaskTemplate.findFirst({
      where: {
        serviceId: serviceIdBigInt,
        service: { businessId: businessIdBigInt },
        title: nextTitle,
        phase: nextPhase,
        NOT: { id: templateIdBigInt },
      },
    });
    if (duplicate) {
      return withIdNoStore(badRequest('Un template avec ce titre et cette phase existe déjà.'), requestId);
    }
  }

  const updated = await prisma.serviceTaskTemplate.update({
    where: { id: templateIdBigInt },
    data: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...('phase' in updates ? { phase: updates.phase ?? null } : {}),
      ...('defaultAssigneeRole' in updates
        ? { defaultAssigneeRole: updates.defaultAssigneeRole ?? null }
        : {}),
      ...('defaultDueOffsetDays' in updates
        ? { defaultDueOffsetDays: updates.defaultDueOffsetDays ?? null }
        : {}),
    },
  });

  return withIdNoStore(jsonNoStore(serializeTemplate(updated)), requestId);
}

// DELETE /api/pro/businesses/{businessId}/services/{serviceId}/templates/{templateId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string; templateId: string }> }
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

  const { businessId, serviceId, templateId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  const templateIdBigInt = parseId(templateId);
  if (!businessIdBigInt || !serviceIdBigInt || !templateIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const existing = await getTemplate(businessIdBigInt, serviceIdBigInt, templateIdBigInt);
  if (!existing) {
    return withIdNoStore(NextResponse.json({ error: 'Template introuvable.' }, { status: 404 }), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:services:templates:delete:${businessIdBigInt}:${serviceIdBigInt}:${templateIdBigInt}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  await prisma.serviceTaskTemplate.delete({ where: { id: templateIdBigInt } });

  return withIdNoStore(jsonNoStore({ ok: true }), requestId);
}
