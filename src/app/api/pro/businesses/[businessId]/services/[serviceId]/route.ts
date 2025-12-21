import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { BusinessReferenceType, TaskPhase } from '@/generated/prisma/client';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function validateCode(code: string) {
  if (!code) return 'Code requis.';
  if (!/^SER-[0-9A-Za-z_-]+$/.test(code)) return 'Code invalide (format SER-XXX).';
  if (code.length > 50) return 'Code trop long.';
  return null;
}

type ServiceTemplateInput = {
  id: bigint | null;
  phase: TaskPhase | null;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

type ServiceBodyParsed =
  | { error: string }
  | {
      code: string;
      name: string;
      categoryReferenceId: bigint | null | undefined;
      tagReferenceIds: bigint[] | undefined;
      type: string | null;
      description: string | null;
      defaultPriceCents: number | null;
      tjmCents: number | null;
      durationHours: number | null;
      vatRate: number | null;
      templates: ServiceTemplateInput[];
    };

function validateServiceBody(body: unknown): ServiceBodyParsed {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const code = normalizeStr(body.code);
  const name = normalizeStr(body.name);
  const type = normalizeStr(body.type);
  const description = normalizeStr(body.description);
  const defaultPriceCents =
    typeof body.defaultPriceCents === 'number' && Number.isFinite(body.defaultPriceCents)
      ? Math.max(0, Math.trunc(body.defaultPriceCents))
      : null;
  const tjmCents =
    typeof body.tjmCents === 'number' && Number.isFinite(body.tjmCents)
      ? Math.max(0, Math.trunc(body.tjmCents))
      : null;
  const durationHours =
    typeof body.durationHours === 'number' && Number.isFinite(body.durationHours)
      ? Math.max(0, Math.trunc(body.durationHours))
      : null;
  const vatRate =
    typeof body.vatRate === 'number' && Number.isFinite(body.vatRate)
      ? Math.max(0, Math.trunc(body.vatRate))
      : null;

  const codeErr = validateCode(code);
  if (codeErr) return { error: codeErr };
  if (!name) return { error: 'Nom requis.' };
  if (name.length > 140) return { error: 'Nom trop long (140 max).' };
  if (description && description.length > 2000) return { error: 'Description trop longue.' };

  const templates: ServiceTemplateInput[] = Array.isArray(body.taskTemplates)
    ? body.taskTemplates.filter(isRecord).map((t) => {
        const phaseRaw = typeof t.phase === 'string' ? t.phase : null;
        const phase =
          phaseRaw && Object.values(TaskPhase).includes(phaseRaw as TaskPhase)
            ? (phaseRaw as TaskPhase)
            : null;
        return {
          id: typeof t.id === 'string' && /^\d+$/.test(t.id) ? BigInt(t.id) : null,
          phase,
          title: normalizeStr(t.title),
          defaultAssigneeRole: normalizeStr(t.defaultAssigneeRole || '') || null,
          defaultDueOffsetDays:
            typeof t.defaultDueOffsetDays === 'number' && Number.isFinite(t.defaultDueOffsetDays)
              ? Math.trunc(t.defaultDueOffsetDays)
              : null,
        };
      })
    : [];

  for (const tpl of templates) {
    if (!tpl.title) return { error: 'Template tâche : titre requis.' };
    if (tpl.title.length > 180) return { error: 'Template tâche : titre trop long.' };
    if (tpl.defaultAssigneeRole && tpl.defaultAssigneeRole.length > 120)
      return { error: 'Template tâche : assigneeRole trop long.' };
  }

  const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'categoryReferenceId');
  const categoryReferenceId =
    categoryProvided && typeof body.categoryReferenceId === 'string' && /^\d+$/.test(body.categoryReferenceId)
      ? BigInt(body.categoryReferenceId)
      : categoryProvided
        ? null
        : undefined;

  const tagProvided = Object.prototype.hasOwnProperty.call(body, 'tagReferenceIds');
  const tagReferenceIds: bigint[] | undefined = tagProvided
    ? Array.from(
        new Set(
          (Array.isArray(body.tagReferenceIds) ? body.tagReferenceIds : [])
            .filter((id) => typeof id === 'string' && /^\d+$/.test(id))
            .map((id) => BigInt(id as string))
        )
      )
    : undefined;

  return {
    code,
    name,
    categoryReferenceId,
    tagReferenceIds,
    type: type || null,
    description: description || null,
    defaultPriceCents,
    tjmCents,
    durationHours,
    vatRate,
    templates,
  };
}

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({
    where: { id: serviceId, businessId },
    include: {
      taskTemplates: true,
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });
}

function ensureServiceDelegate(requestId: string) {
  if (!(prisma as { service?: unknown }).service) {
    return withIdNoStore(
      NextResponse.json(
        { error: 'Prisma client not generated / wrong import (service delegate absent).' },
        { status: 500 }
      ),
      requestId
    );
  }
  return null;
}

async function validateCategoryAndTags(
  businessId: bigint,
  categoryReferenceId: bigint | null,
  tagReferenceIds?: bigint[]
): Promise<{ categoryId: bigint | null; tagIds: bigint[] } | { error: string }> {
  if (categoryReferenceId) {
    const category = await prisma.businessReference.findFirst({
      where: {
        id: categoryReferenceId,
        businessId,
        type: BusinessReferenceType.CATEGORY,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!category) {
      return { error: 'categoryReferenceId invalide pour ce business.' };
    }
  }

  let tagIds: bigint[] = [];
  if (tagReferenceIds && tagReferenceIds.length) {
    const tags = await prisma.businessReference.findMany({
      where: {
        id: { in: tagReferenceIds },
        businessId,
        type: BusinessReferenceType.TAG,
        isArchived: false,
      },
      select: { id: true },
    });
    if (tags.length !== tagReferenceIds.length) {
      return { error: 'tagReferenceIds invalides pour ce business.' };
    }
    tagIds = tags.map((t) => t.id);
  }

  return { categoryId: categoryReferenceId, tagIds };
}

// GET /api/pro/businesses/{businessId}/services/{serviceId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const delegateError = ensureServiceDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden();

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) {
    return withRequestId(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  return jsonNoStore({
    id: service.id.toString(),
    businessId: service.businessId.toString(),
    code: service.code,
    name: service.name,
    categoryReferenceId: service.categoryReferenceId ? service.categoryReferenceId.toString() : null,
    categoryReferenceName: service.categoryReference?.name ?? null,
    tagReferences: service.tags.map((t) => ({ id: t.reference.id.toString(), name: t.reference.name })),
    type: service.type,
    description: service.description,
    defaultPriceCents: service.defaultPriceCents?.toString() ?? null,
    tjmCents: service.tjmCents?.toString() ?? null,
    durationHours: service.durationHours,
    vatRate: service.vatRate,
    taskTemplates: service.taskTemplates.map((tpl) => ({
      id: tpl.id.toString(),
      phase: tpl.phase,
      title: tpl.title,
      defaultAssigneeRole: tpl.defaultAssigneeRole,
      defaultDueOffsetDays: tpl.defaultDueOffsetDays,
    })),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  });
}

// PATCH /api/pro/businesses/{businessId}/services/{serviceId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
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

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const delegateError = ensureServiceDelegate(requestId);
  if (delegateError) return delegateError;

  const limited = rateLimit(request, {
    key: `pro:services:update:${businessIdBigInt}:${serviceIdBigInt}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = validateServiceBody(body);
  if ('error' in parsed) return withRequestId(badRequest(parsed.error), requestId);

  const existing = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!existing) {
    return withRequestId(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  const categoryToApply =
    parsed.categoryReferenceId !== undefined ? parsed.categoryReferenceId : existing.categoryReferenceId;
  const tagsToApply =
    parsed.tagReferenceIds !== undefined
      ? parsed.tagReferenceIds
      : existing.tags.map((t) => t.referenceId).filter((id): id is bigint => !!id);

  const validated = await validateCategoryAndTags(
    businessIdBigInt,
    categoryToApply ?? null,
    tagsToApply
  );
  if ('error' in validated) {
    return withRequestId(badRequest(validated.error), requestId);
  }

  const updateData: Record<string, unknown> = {
    code: parsed.code,
    name: parsed.name,
    type: parsed.type || undefined,
    description: parsed.description || undefined,
    defaultPriceCents: parsed.defaultPriceCents ?? undefined,
    tjmCents: parsed.tjmCents ?? undefined,
    durationHours: parsed.durationHours ?? undefined,
    vatRate: parsed.vatRate ?? undefined,
    taskTemplates: parsed.templates.length
      ? {
          deleteMany: { serviceId: serviceIdBigInt },
          create: parsed.templates.map((tpl) => ({
            phase: tpl.phase ?? undefined,
            title: tpl.title,
            defaultAssigneeRole: tpl.defaultAssigneeRole || undefined,
            defaultDueOffsetDays: tpl.defaultDueOffsetDays ?? undefined,
          })),
        }
      : undefined,
  };

  if (parsed.categoryReferenceId !== undefined) {
    updateData.categoryReferenceId = validated.categoryId;
  }
  if (parsed.tagReferenceIds !== undefined) {
    updateData.tags = {
      deleteMany: { serviceId: serviceIdBigInt },
      create: validated.tagIds.map((id) => ({ referenceId: id })),
    };
  }

  const updated = await prisma.service.update({
    where: { id: serviceIdBigInt },
    data: updateData,
    include: {
      taskTemplates: true,
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return jsonNoStore({
    id: updated.id.toString(),
    businessId: updated.businessId.toString(),
    code: updated.code,
    name: updated.name,
    categoryReferenceId: updated.categoryReferenceId ? updated.categoryReferenceId.toString() : null,
    categoryReferenceName: updated.categoryReference?.name ?? null,
    tagReferences: updated.tags.map((t) => ({ id: t.reference.id.toString(), name: t.reference.name })),
    type: updated.type,
    description: updated.description,
    defaultPriceCents: updated.defaultPriceCents?.toString() ?? null,
    tjmCents: updated.tjmCents?.toString() ?? null,
    durationHours: updated.durationHours,
    vatRate: updated.vatRate,
    taskTemplates: updated.taskTemplates.map((tpl) => ({
      id: tpl.id.toString(),
      phase: tpl.phase,
      title: tpl.title,
      defaultAssigneeRole: tpl.defaultAssigneeRole,
      defaultDueOffsetDays: tpl.defaultDueOffsetDays,
    })),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

// DELETE /api/pro/businesses/{businessId}/services/{serviceId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
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

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const delegateError = ensureServiceDelegate(requestId);
  if (delegateError) return delegateError;

  const limited = rateLimit(request, {
    key: `pro:services:delete:${businessIdBigInt}:${serviceIdBigInt}`,
    limit: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const existing = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!existing) {
    return withRequestId(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  await prisma.service.delete({ where: { id: serviceIdBigInt } });

  return jsonNoStore({ ok: true });
}
