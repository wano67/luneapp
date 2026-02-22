import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { applyServiceProcessTemplateToProjectService } from '@/server/services/process/applyServiceProcessTemplate';
import { applyServiceTaskTemplatesToProjectService } from '@/server/services/process/applyServiceTaskTemplates';
import { resolveServiceUnitPriceCents } from '@/server/services/pricing';
import { BillingUnit, DiscountType } from '@/generated/prisma';

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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function forbidden(requestId: string) {
  return withIdNoStore(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), requestId);
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
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden(requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  const items = await prisma.projectService.findMany({
    where: { projectId: projectIdBigInt },
    include: { service: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  return withIdNoStore(
    jsonNoStore({
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
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/projects/{projectId}/services
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
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

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
  });
  if (!project) {
    return withIdNoStore(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withIdNoStore(badRequest('Payload invalide.'), requestId);
  const serviceIdBigInt = parseId(typeof body.serviceId === 'string' ? body.serviceId : undefined);
  if (!serviceIdBigInt) return withIdNoStore(badRequest('serviceId invalide.'), requestId);

  const generateTasks = body.generateTasks !== false;
  const taskAssigneeRaw = (body as { taskAssigneeUserId?: unknown }).taskAssigneeUserId;
  let taskAssigneeUserId: bigint | null = null;
  if (taskAssigneeRaw !== undefined && taskAssigneeRaw !== null && taskAssigneeRaw !== '') {
    if (typeof taskAssigneeRaw !== 'string' || !/^\d+$/.test(taskAssigneeRaw)) {
      return withIdNoStore(badRequest('taskAssigneeUserId invalide.'), requestId);
    }
    const assigneeId = BigInt(taskAssigneeRaw);
    const membership = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: assigneeId } },
    });
    if (!membership) return withIdNoStore(badRequest('taskAssigneeUserId doit être membre du business.'), requestId);
    taskAssigneeUserId = assigneeId;
  }
  const dueOffsetRaw = (body as { taskDueOffsetDays?: unknown }).taskDueOffsetDays;
  let taskDueOffsetDays: number | null = null;
  if (dueOffsetRaw !== undefined) {
    if (dueOffsetRaw === null) {
      taskDueOffsetDays = null;
    } else if (typeof dueOffsetRaw === 'number' && Number.isFinite(dueOffsetRaw)) {
      taskDueOffsetDays = Math.trunc(dueOffsetRaw);
      if (taskDueOffsetDays < 0 || taskDueOffsetDays > 365) {
        return withIdNoStore(badRequest('taskDueOffsetDays invalide (0-365).'), requestId);
      }
    } else {
      return withIdNoStore(badRequest('taskDueOffsetDays invalide.'), requestId);
    }
  }
  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? Math.max(1, Math.trunc(body.quantity)) : 1;
  const priceCentsInput =
    typeof body.priceCents === 'number' && Number.isFinite(body.priceCents)
      ? Math.max(0, Math.trunc(body.priceCents))
      : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
  if (notes && notes.length > 2000) return withIdNoStore(badRequest('Notes trop longues.'), requestId);

  const titleOverride =
    typeof body.titleOverride === 'string' ? body.titleOverride.trim() : undefined;
  if (titleOverride && titleOverride.length > 200) {
    return withIdNoStore(badRequest('Libellé trop long (200 max).'), requestId);
  }

  const description =
    typeof body.description === 'string' ? body.description.trim() : undefined;
  if (description && description.length > 2000) {
    return withIdNoStore(badRequest('Description trop longue (2000 max).'), requestId);
  }

  const discountType =
    typeof body.discountType === 'string' && Object.values(DiscountType).includes(body.discountType as DiscountType)
      ? (body.discountType as DiscountType)
      : DiscountType.NONE;
  const discountValueRaw = typeof body.discountValue === 'number' && Number.isFinite(body.discountValue)
    ? Math.trunc(body.discountValue)
    : null;
  const discountValue =
    discountType === DiscountType.PERCENT
      ? discountValueRaw == null
        ? null
        : Math.min(100, Math.max(0, discountValueRaw))
      : discountType === DiscountType.AMOUNT
        ? discountValueRaw == null
          ? null
          : Math.max(0, discountValueRaw)
        : null;

  const billingUnit =
    typeof body.billingUnit === 'string' && Object.values(BillingUnit).includes(body.billingUnit as BillingUnit)
      ? (body.billingUnit as BillingUnit)
      : BillingUnit.ONE_OFF;
  const unitLabel =
    typeof body.unitLabel === 'string' ? body.unitLabel.trim() : undefined;
  if (unitLabel && unitLabel.length > 20) {
    return withIdNoStore(badRequest('Unité trop longue (20 max).'), requestId);
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceIdBigInt, businessId: businessIdBigInt },
  });
  if (!service) {
    return withIdNoStore(notFound('Service introuvable.'), requestId);
  }

  const resolvedPrice = resolveServiceUnitPriceCents({
    projectPriceCents: priceCentsInput !== null ? BigInt(priceCentsInput) : null,
    defaultPriceCents: service.defaultPriceCents ?? null,
    tjmCents: service.tjmCents ?? null,
  });

  const warning = resolvedPrice.missingPrice
    ? 'Prix manquant pour ce service. La tarification utilisera 0 EUR et la creation de devis sera bloquee tant qu un tarif nest pas defini.'
    : null;

  if (resolvedPrice.missingPrice) {
    console.warn('project-service price missing (pricing will default to 0)', {
      requestId,
      businessId,
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

  return withIdNoStore(
    NextResponse.json(
      {
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
      { status: 201 }
    ),
    requestId
  );
}
