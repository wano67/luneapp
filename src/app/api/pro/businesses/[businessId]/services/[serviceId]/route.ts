import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { TaskPhase } from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { parseCentsInput } from '@/lib/money';
import { ensureDelegate } from '@/server/http/delegates';
import { parseIdOpt, parseStr } from '@/server/http/parsers';

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
  const code = parseStr(body.code) ?? '';
  const name = parseStr(body.name) ?? '';
  const type = parseStr(body.type) ?? '';
  const description = parseStr(body.description) ?? '';
  const defaultPriceCentsRaw = parseCentsInput((body as { defaultPriceCents?: unknown }).defaultPriceCents);
  const defaultPriceCents =
    defaultPriceCentsRaw != null ? Math.max(0, Math.trunc(defaultPriceCentsRaw)) : null;
  const tjmCentsRaw = parseCentsInput((body as { tjmCents?: unknown }).tjmCents);
  const tjmCents = tjmCentsRaw != null ? Math.max(0, Math.trunc(tjmCentsRaw)) : null;
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
          title: parseStr(t.title) ?? '',
          defaultAssigneeRole: parseStr(t.defaultAssigneeRole) ?? null,
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


// GET /api/pro/businesses/{businessId}/services/{serviceId}
export const GET = withBusinessRoute<{ businessId: string; serviceId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
  const { requestId, businessId: businessIdBigInt } = ctx;
  const serviceIdBigInt = parseIdOpt(params.serviceId);
  if (!serviceIdBigInt) return withIdNoStore(badRequest('serviceId invalide.'), requestId);

  const delegateError = ensureDelegate('service', requestId);
  if (delegateError) return delegateError;

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) return withIdNoStore(notFound('Service introuvable.'), requestId);

  return jsonb({
    item: {
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
    },
  }, requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/services/{serviceId}
export const PATCH = withBusinessRoute<{ businessId: string; serviceId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:services:update:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 60 * 60 * 1000 } },
  async (ctx, request, params) => {
  const { requestId, businessId: businessIdBigInt } = ctx;
  const serviceIdBigInt = parseIdOpt(params.serviceId);
  if (!serviceIdBigInt) return withIdNoStore(badRequest('serviceId invalide.'), requestId);

  const delegateError = ensureDelegate('service', requestId);
  if (delegateError) return delegateError;

  const body = await request.json().catch(() => null);
  const parsed = validateServiceBody(body);
  if ('error' in parsed) return withIdNoStore(badRequest(parsed.error), requestId);

  const existing = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!existing) return withIdNoStore(notFound('Service introuvable.'), requestId);

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
    return withIdNoStore(badRequest(validated.error), requestId);
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

  return jsonb({
    item: {
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
    },
  }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/services/{serviceId}
export const DELETE = withBusinessRoute<{ businessId: string; serviceId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:services:delete:${ctx.businessId}:${ctx.userId}`, limit: 50, windowMs: 60 * 60 * 1000 } },
  async (ctx, _request, params) => {
  const { requestId, businessId: businessIdBigInt } = ctx;
  const serviceIdBigInt = parseIdOpt(params.serviceId);
  if (!serviceIdBigInt) return withIdNoStore(badRequest('serviceId invalide.'), requestId);

  const delegateError = ensureDelegate('service', requestId);
  if (delegateError) return delegateError;

  const existing = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!existing) return withIdNoStore(notFound('Service introuvable.'), requestId);

  await prisma.service.delete({ where: { id: serviceIdBigInt } });

  return jsonbNoContent(requestId);
  }
);
