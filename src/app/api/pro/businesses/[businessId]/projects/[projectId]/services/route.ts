import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { applyServiceProcessTemplateToProjectService } from '@/server/services/process/applyServiceProcessTemplate';
import { applyServiceTaskTemplatesToProjectService } from '@/server/services/process/applyServiceTaskTemplates';
import { resolveServiceUnitPriceCents } from '@/server/services/pricing';
import { BillingUnit, DiscountType } from '@/generated/prisma';
import { parseCentsInput } from '@/lib/money';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}/services
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('Ids invalides.');
    const projectIdBigInt = BigInt(projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const items = await prisma.projectService.findMany({
      where: { projectId: projectIdBigInt },
      include: { service: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return jsonb(
      {
        items: items.map((it) => ({
          id: it.id.toString(),
          projectId: it.projectId.toString(),
          serviceId: it.serviceId.toString(),
          quantity: it.quantity,
          priceCents: it.priceCents?.toString() ?? null,
          notes: it.notes,
          titleOverride: it.titleOverride ?? null,
          description: it.description ?? null,
          discountType: it.discountType,
          discountValue: it.discountValue ?? null,
          billingUnit: it.billingUnit,
          unitLabel: it.unitLabel ?? null,
          position: it.position,
          createdAt: it.createdAt.toISOString(),
          service: {
            id: it.service.id.toString(),
            code: it.service.code,
            name: it.service.name,
            type: it.service.type,
          },
        })),
      },
      requestId
    );
  }
);

// POST /api/pro/businesses/{businessId}/projects/{projectId}/services
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-services:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('Ids invalides.');
    const projectIdBigInt = BigInt(projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return badRequest('Payload invalide.');
    const serviceIdRaw = typeof body.serviceId === 'string' ? body.serviceId : undefined;
    if (!serviceIdRaw || !/^\d+$/.test(serviceIdRaw)) return badRequest('serviceId invalide.');
    const serviceIdBigInt = BigInt(serviceIdRaw);

    const generateTasks = body.generateTasks !== false;
    const taskAssigneeRaw = (body as { taskAssigneeUserId?: unknown }).taskAssigneeUserId;
    let taskAssigneeUserId: bigint | null = null;
    if (taskAssigneeRaw !== undefined && taskAssigneeRaw !== null && taskAssigneeRaw !== '') {
      if (typeof taskAssigneeRaw !== 'string' || !/^\d+$/.test(taskAssigneeRaw)) {
        return badRequest('taskAssigneeUserId invalide.');
      }
      const assigneeId = BigInt(taskAssigneeRaw);
      const member = await prisma.businessMembership.findUnique({
        where: { businessId_userId: { businessId: businessIdBigInt, userId: assigneeId } },
      });
      if (!member) return badRequest('taskAssigneeUserId doit être membre du business.');
      taskAssigneeUserId = assigneeId;
    }

    const dueOffsetRaw = (body as { taskDueOffsetDays?: unknown }).taskDueOffsetDays;
    let taskDueOffsetDays: number | null = null;
    if (dueOffsetRaw !== undefined) {
      if (dueOffsetRaw === null) {
        taskDueOffsetDays = null;
      } else if (typeof dueOffsetRaw === 'number' && Number.isFinite(dueOffsetRaw)) {
        taskDueOffsetDays = Math.trunc(dueOffsetRaw);
        if (taskDueOffsetDays < 0 || taskDueOffsetDays > 365) return badRequest('taskDueOffsetDays invalide (0-365).');
      } else {
        return badRequest('taskDueOffsetDays invalide.');
      }
    }

    const quantity =
      typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? Math.max(1, Math.trunc(body.quantity)) : 1;
    const priceCentsRaw = (body as { priceCents?: unknown }).priceCents;
    const priceCentsParsed = priceCentsRaw !== undefined ? parseCentsInput(priceCentsRaw) : null;
    const priceCentsInput = priceCentsParsed != null ? Math.max(0, Math.trunc(priceCentsParsed)) : null;

    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
    if (notes && notes.length > 2000) return badRequest('Notes trop longues.');

    const titleOverride = typeof body.titleOverride === 'string' ? body.titleOverride.trim() : undefined;
    if (titleOverride && titleOverride.length > 200) return badRequest('Libellé trop long (200 max).');

    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    if (description && description.length > 2000) return badRequest('Description trop longue (2000 max).');

    const discountType =
      typeof body.discountType === 'string' && Object.values(DiscountType).includes(body.discountType as DiscountType)
        ? (body.discountType as DiscountType)
        : DiscountType.NONE;
    const discountValueRaw = (body as { discountValue?: unknown }).discountValue;
    const discountValue =
      discountType === DiscountType.PERCENT
        ? typeof discountValueRaw === 'number' && Number.isFinite(discountValueRaw)
          ? Math.min(100, Math.max(0, Math.trunc(discountValueRaw)))
          : null
        : discountType === DiscountType.AMOUNT
          ? (() => {
              const parsed = parseCentsInput(discountValueRaw);
              return parsed == null ? null : Math.max(0, Math.trunc(parsed));
            })()
          : null;

    const billingUnit =
      typeof body.billingUnit === 'string' && Object.values(BillingUnit).includes(body.billingUnit as BillingUnit)
        ? (body.billingUnit as BillingUnit)
        : BillingUnit.ONE_OFF;
    const unitLabel = typeof body.unitLabel === 'string' ? body.unitLabel.trim() : undefined;
    if (unitLabel && unitLabel.length > 20) return badRequest('Unité trop longue (20 max).');

    const service = await prisma.service.findFirst({
      where: { id: serviceIdBigInt, businessId: businessIdBigInt },
    });
    if (!service) return notFound('Service introuvable.');

    const resolvedPrice = resolveServiceUnitPriceCents({
      projectPriceCents: priceCentsInput !== null ? BigInt(priceCentsInput) : null,
      defaultPriceCents: service.defaultPriceCents ?? null,
      tjmCents: service.tjmCents ?? null,
    });

    if (resolvedPrice.missingPrice) {
      console.warn('project-service price missing (pricing will default to 0)', {
        requestId,
        businessId: businessIdBigInt.toString(),
        projectId,
        serviceId: serviceIdBigInt.toString(),
      });
    }

    const lastPosition = await prisma.projectService.findFirst({
      where: { projectId: projectIdBigInt },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (lastPosition?.position ?? -1) + 1;

    const created = await prisma.projectService.create({
      data: {
        projectId: projectIdBigInt,
        serviceId: serviceIdBigInt,
        quantity,
        priceCents: resolvedPrice.source === 'missing' ? undefined : resolvedPrice.unitPriceCents,
        notes: notes || undefined,
        titleOverride: titleOverride || undefined,
        description: description || undefined,
        discountType,
        discountValue: discountValue ?? undefined,
        billingUnit,
        unitLabel: unitLabel || undefined,
        position,
      },
      include: { service: true },
    });

    let generatedStepsCount = 0;
    let generatedTasksCount = 0;

    if (generateTasks) {
      const generated = await applyServiceProcessTemplateToProjectService({
        businessId: businessIdBigInt,
        projectId: projectIdBigInt,
        projectServiceId: created.id,
        assigneeUserId: taskAssigneeUserId ?? undefined,
        dueOffsetDaysOverride: taskDueOffsetDays ?? undefined,
      });
      if (generated.templateFound) {
        generatedStepsCount = generated.createdStepsCount;
        generatedTasksCount = generated.createdTasksCount;
      } else {
        const fallback = await applyServiceTaskTemplatesToProjectService({
          businessId: businessIdBigInt,
          projectId: projectIdBigInt,
          projectServiceId: created.id,
          assigneeUserId: taskAssigneeUserId ?? undefined,
          dueOffsetDaysOverride: taskDueOffsetDays ?? undefined,
        });
        generatedTasksCount = fallback.createdTasksCount;
      }
    }

    const warning = resolvedPrice.missingPrice
      ? 'Prix manquant pour ce service. La tarification utilisera 0 EUR et la creation de devis sera bloquee tant qu un tarif nest pas defini.'
      : null;

    return jsonbCreated(
      {
        item: {
          id: created.id.toString(),
          projectId: created.projectId.toString(),
          serviceId: created.serviceId.toString(),
          quantity: created.quantity,
          priceCents: created.priceCents?.toString() ?? null,
          notes: created.notes,
          titleOverride: created.titleOverride ?? null,
          description: created.description ?? null,
          discountType: created.discountType,
          discountValue: created.discountValue ?? null,
          billingUnit: created.billingUnit,
          unitLabel: created.unitLabel ?? null,
          position: created.position,
          createdAt: created.createdAt.toISOString(),
          service: {
            id: created.service.id.toString(),
            code: created.service.code,
            name: created.service.name,
            type: created.service.type,
          },
          generatedStepsCount,
          generatedTasksCount,
          ...(warning ? { warning } : {}),
        },
      },
      requestId
    );
  }
);
