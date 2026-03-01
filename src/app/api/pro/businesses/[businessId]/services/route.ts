import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { TaskPhase, ServiceUnit } from '@/generated/prisma';
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
      costCents: number | null;
      unit: ServiceUnit;
      defaultQuantity: number;
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
  const costCentsRaw = parseCentsInput((body as { costCents?: unknown }).costCents);
  const costCents = costCentsRaw != null ? Math.max(0, Math.trunc(costCentsRaw)) : null;
  const unitRaw = parseStr(body.unit) ?? '';
  const unit: ServiceUnit = Object.values(ServiceUnit).includes(unitRaw as ServiceUnit)
    ? (unitRaw as ServiceUnit)
    : ServiceUnit.FORFAIT;
  const defaultQuantity =
    typeof body.defaultQuantity === 'number' && Number.isFinite(body.defaultQuantity)
      ? Math.max(1, Math.trunc(body.defaultQuantity))
      : 1;
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
    costCents,
    unit,
    defaultQuantity,
    durationHours,
    vatRate,
    templates,
  };
}


// GET /api/pro/businesses/{businessId}/services
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const delegateError = ensureDelegate('service', requestId);
  if (delegateError) return delegateError;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const type = searchParams.get('type')?.trim();
  const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
  const tagReferenceIdParam = searchParams.get('tagReferenceId');

  const categoryReferenceId = categoryReferenceIdParam ? parseIdOpt(categoryReferenceIdParam) : null;
  if (categoryReferenceIdParam && !categoryReferenceId) {
    return withIdNoStore(badRequest('categoryReferenceId invalide.'), requestId);
  }
  const tagReferenceId = tagReferenceIdParam ? parseIdOpt(tagReferenceIdParam) : null;
  if (tagReferenceIdParam && !tagReferenceId) {
    return withIdNoStore(badRequest('tagReferenceId invalide.'), requestId);
  }

  const services = await prisma.service.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(type ? { type: { equals: type, mode: 'insensitive' } } : {}),
      ...(categoryReferenceId ? { categoryReferenceId } : {}),
      ...(tagReferenceId ? { tags: { some: { referenceId: tagReferenceId } } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      _count: { select: { taskTemplates: true } },
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return jsonb({
    items: services.map((s) => ({
      id: s.id.toString(),
      businessId: s.businessId.toString(),
      code: s.code,
      name: s.name,
      type: s.type,
      description: s.description,
      categoryReferenceId: s.categoryReferenceId ? s.categoryReferenceId.toString() : null,
      categoryReferenceName: s.categoryReference?.name ?? null,
      tagReferences: s.tags.map((t) => ({ id: t.reference.id.toString(), name: t.reference.name })),
      defaultPriceCents: s.defaultPriceCents?.toString() ?? null,
      tjmCents: s.tjmCents?.toString() ?? null,
      costCents: s.costCents?.toString() ?? null,
      unit: s.unit,
      defaultQuantity: s.defaultQuantity,
      durationHours: s.durationHours,
      vatRate: s.vatRate,
      templateCount: s._count?.taskTemplates ?? 0,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  }, requestId);
});

// POST /api/pro/businesses/{businessId}/services
export const POST = withBusinessRoute(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:services:create:${ctx.businessId}:${ctx.userId}`, limit: 120, windowMs: 60 * 60 * 1000 } },
  async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const delegateError = ensureDelegate('service', requestId);
  if (delegateError) return delegateError;

  const body = await request.json().catch(() => null);
  const parsed = validateServiceBody(body);
  if ('error' in parsed) return withIdNoStore(badRequest(parsed.error), requestId);

  const validated = await validateCategoryAndTags(
    businessIdBigInt,
    parsed.categoryReferenceId ?? null,
    parsed.tagReferenceIds
  );
  if ('error' in validated) {
    return withIdNoStore(badRequest(validated.error), requestId);
  }

  try {
    const created = await prisma.service.create({
      data: {
        businessId: businessIdBigInt,
        code: parsed.code,
        name: parsed.name,
        categoryReferenceId: validated.categoryId ?? undefined,
        type: parsed.type || undefined,
        description: parsed.description || undefined,
        defaultPriceCents: parsed.defaultPriceCents ?? undefined,
        tjmCents: parsed.tjmCents ?? undefined,
        costCents: parsed.costCents ?? undefined,
        unit: parsed.unit,
        defaultQuantity: parsed.defaultQuantity,
        durationHours: parsed.durationHours ?? undefined,
        vatRate: parsed.vatRate ?? undefined,
        tags:
          validated.tagIds.length > 0
            ? {
                create: validated.tagIds.map((id) => ({ referenceId: id })),
              }
            : undefined,
        taskTemplates: parsed.templates.length
          ? {
              create: parsed.templates.map((tpl) => ({
                phase: tpl.phase ?? undefined,
                title: tpl.title,
                defaultAssigneeRole: tpl.defaultAssigneeRole || undefined,
                defaultDueOffsetDays: tpl.defaultDueOffsetDays ?? undefined,
              })),
            }
          : undefined,
      },
      include: { taskTemplates: true },
    });

    return jsonb(
      {
        item: {
          id: created.id.toString(),
          businessId: created.businessId.toString(),
          code: created.code,
          name: created.name,
          categoryReferenceId: created.categoryReferenceId ? created.categoryReferenceId.toString() : null,
          type: created.type,
          description: created.description,
          defaultPriceCents: created.defaultPriceCents?.toString() ?? null,
          tjmCents: created.tjmCents?.toString() ?? null,
          costCents: created.costCents?.toString() ?? null,
          unit: created.unit,
          defaultQuantity: created.defaultQuantity,
          durationHours: created.durationHours,
          vatRate: created.vatRate,
          templateCount: created.taskTemplates.length,
          tagReferences: validated.tagIds.map((id) => ({ id: id.toString() })),
          taskTemplates: created.taskTemplates.map((tpl) => ({
            id: tpl.id.toString(),
            phase: tpl.phase,
            title: tpl.title,
            defaultAssigneeRole: tpl.defaultAssigneeRole,
            defaultDueOffsetDays: tpl.defaultDueOffsetDays,
          })),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      requestId,
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return withIdNoStore(badRequest('Création impossible.'), requestId);
  }
  }
);
