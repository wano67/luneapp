import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { BillingUnit, DiscountType } from '@/generated/prisma';
import { parseCentsInput } from '@/lib/money';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

async function getItem(businessId: bigint, projectId: bigint, itemId: bigint) {
  return prisma.projectService.findFirst({
    where: {
      id: itemId,
      projectId,
      project: { businessId },
    },
    include: { service: true },
  });
}

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}
export const PATCH = withBusinessRoute<{ businessId: string; projectId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-services:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    const itemId = params?.itemId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('Ids invalides.');
    if (!itemId || !/^\d+$/.test(itemId)) return badRequest('Ids invalides.');
    const projectIdBigInt = BigInt(projectId);
    const itemIdBigInt = BigInt(itemId);

    const existing = await getItem(businessIdBigInt, projectIdBigInt, itemIdBigInt);
    if (!existing) return notFound('Élément introuvable.');

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const quantity =
      typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? Math.max(1, Math.trunc(body.quantity)) : null;
    const priceCentsRaw = (body as { priceCents?: unknown }).priceCents;
    const priceCentsParsed = priceCentsRaw !== undefined ? parseCentsInput(priceCentsRaw) : null;
    const priceCents = priceCentsParsed != null ? Math.max(0, Math.trunc(priceCentsParsed)) : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
    if (notes && notes.length > 2000) return badRequest('Notes trop longues.');

    const data: Record<string, unknown> = {
      quantity: quantity ?? undefined,
      priceCents: priceCents ?? undefined,
      notes: notes ?? undefined,
    };

    if (Object.prototype.hasOwnProperty.call(body, 'titleOverride')) {
      const titleOverride =
        body.titleOverride == null ? null : typeof body.titleOverride === 'string' ? body.titleOverride.trim() : undefined;
      if (titleOverride === undefined) return badRequest('Libellé invalide.');
      if (titleOverride && titleOverride.length > 200) return badRequest('Libellé trop long (200 max).');
      data.titleOverride = titleOverride || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      const description =
        body.description == null ? null : typeof body.description === 'string' ? body.description.trim() : undefined;
      if (description === undefined) return badRequest('Description invalide.');
      if (description && description.length > 2000) return badRequest('Description trop longue (2000 max).');
      data.description = description || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, 'discountType') ||
      Object.prototype.hasOwnProperty.call(body, 'discountValue')
    ) {
      const discountTypeRaw = (body as Record<string, unknown>).discountType;
      const discountType =
        typeof discountTypeRaw === 'string' && Object.values(DiscountType).includes(discountTypeRaw as DiscountType)
          ? (discountTypeRaw as DiscountType)
          : DiscountType.NONE;
      const discountValueRaw = (body as Record<string, unknown>).discountValue;
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
      data.discountType = discountType;
      data.discountValue = discountValue ?? null;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, 'billingUnit') ||
      Object.prototype.hasOwnProperty.call(body, 'unitLabel')
    ) {
      const billingUnitRaw = (body as Record<string, unknown>).billingUnit;
      if (billingUnitRaw !== undefined) {
        if (typeof billingUnitRaw !== 'string' || !Object.values(BillingUnit).includes(billingUnitRaw as BillingUnit)) {
          return badRequest('billingUnit invalide.');
        }
        data.billingUnit = billingUnitRaw as BillingUnit;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'unitLabel')) {
        const unitLabelRaw = (body as Record<string, unknown>).unitLabel;
        if (unitLabelRaw == null) {
          data.unitLabel = null;
        } else if (typeof unitLabelRaw === 'string') {
          const unitLabel = unitLabelRaw.trim();
          if (unitLabel.length > 20) return badRequest('Unité trop longue (20 max).');
          data.unitLabel = unitLabel || null;
        } else {
          return badRequest('unitLabel invalide.');
        }
      }
    }

    const updated = await prisma.projectService.update({
      where: { id: itemIdBigInt },
      data,
      include: { service: true },
    });

    return jsonb(
      {
        item: {
          id: updated.id.toString(),
          projectId: updated.projectId.toString(),
          serviceId: updated.serviceId.toString(),
          quantity: updated.quantity,
          priceCents: updated.priceCents?.toString() ?? null,
          notes: updated.notes,
          titleOverride: updated.titleOverride ?? null,
          description: updated.description ?? null,
          discountType: updated.discountType,
          discountValue: updated.discountValue ?? null,
          billingUnit: updated.billingUnit,
          unitLabel: updated.unitLabel ?? null,
          createdAt: updated.createdAt.toISOString(),
          service: {
            id: updated.service.id.toString(),
            code: updated.service.code,
            name: updated.service.name,
            type: updated.service.type,
          },
        },
      },
      requestId
    );
  }
);

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-services:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    const itemId = params?.itemId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('Ids invalides.');
    if (!itemId || !/^\d+$/.test(itemId)) return badRequest('Ids invalides.');
    const projectIdBigInt = BigInt(projectId);
    const itemIdBigInt = BigInt(itemId);

    const existing = await getItem(businessIdBigInt, projectIdBigInt, itemIdBigInt);
    if (!existing) return notFound('Élément introuvable.');

    await prisma.$transaction(async (tx) => {
      const stepIds = await tx.projectServiceStep.findMany({
        where: { projectServiceId: itemIdBigInt },
        select: { id: true },
      });

      await tx.task.updateMany({
        where: { projectServiceId: itemIdBigInt },
        data: { projectServiceId: null },
      });

      if (stepIds.length) {
        await tx.task.updateMany({
          where: { projectServiceStepId: { in: stepIds.map((s) => s.id) } },
          data: { projectServiceStepId: null },
        });
      }

      await tx.projectService.delete({ where: { id: itemIdBigInt } });
    });

    return jsonbNoContent(requestId);
  }
);
