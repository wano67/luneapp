import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
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
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; itemId: string }> }
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

  const { businessId, projectId, itemId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !projectIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await getItem(businessIdBigInt, projectIdBigInt, itemIdBigInt);
  if (!existing) {
    return withIdNoStore(notFound('Élément introuvable.'), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? Math.max(1, Math.trunc(body.quantity)) : null;
  const priceCents =
    typeof body.priceCents === 'number' && Number.isFinite(body.priceCents)
      ? Math.max(0, Math.trunc(body.priceCents))
      : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
  if (notes && notes.length > 2000) return withIdNoStore(badRequest('Notes trop longues.'), requestId);

  const data: Record<string, unknown> = {
    quantity: quantity ?? undefined,
    priceCents: priceCents ?? undefined,
    notes: notes ?? undefined,
  };

  if (Object.prototype.hasOwnProperty.call(body, 'titleOverride')) {
    const titleOverride =
      body.titleOverride == null ? null : typeof body.titleOverride === 'string' ? body.titleOverride.trim() : undefined;
    if (titleOverride === undefined) return withIdNoStore(badRequest('Libellé invalide.'), requestId);
    if (titleOverride && titleOverride.length > 200) {
      return withIdNoStore(badRequest('Libellé trop long (200 max).'), requestId);
    }
    data.titleOverride = titleOverride || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description =
      body.description == null ? null : typeof body.description === 'string' ? body.description.trim() : undefined;
    if (description === undefined) return withIdNoStore(badRequest('Description invalide.'), requestId);
    if (description && description.length > 2000) {
      return withIdNoStore(badRequest('Description trop longue (2000 max).'), requestId);
    }
    data.description = description || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'discountType') || Object.prototype.hasOwnProperty.call(body, 'discountValue')) {
    const discountTypeRaw = (body as Record<string, unknown>).discountType;
    const discountType =
      typeof discountTypeRaw === 'string' && Object.values(DiscountType).includes(discountTypeRaw as DiscountType)
        ? (discountTypeRaw as DiscountType)
        : DiscountType.NONE;
    const discountValueRaw =
      typeof (body as Record<string, unknown>).discountValue === 'number' &&
      Number.isFinite((body as Record<string, unknown>).discountValue)
        ? Math.trunc((body as Record<string, unknown>).discountValue as number)
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
    data.discountType = discountType;
    data.discountValue = discountValue ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'billingUnit') || Object.prototype.hasOwnProperty.call(body, 'unitLabel')) {
    const billingUnitRaw = (body as Record<string, unknown>).billingUnit;
    if (billingUnitRaw !== undefined) {
      if (typeof billingUnitRaw !== 'string' || !Object.values(BillingUnit).includes(billingUnitRaw as BillingUnit)) {
        return withIdNoStore(badRequest('billingUnit invalide.'), requestId);
      }
      data.billingUnit = billingUnitRaw as BillingUnit;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'unitLabel')) {
      const unitLabelRaw = (body as Record<string, unknown>).unitLabel;
      if (unitLabelRaw == null) {
        data.unitLabel = null;
      } else if (typeof unitLabelRaw === 'string') {
        const unitLabel = unitLabelRaw.trim();
        if (unitLabel.length > 20) return withIdNoStore(badRequest('Unité trop longue (20 max).'), requestId);
        data.unitLabel = unitLabel || null;
      } else {
        return withIdNoStore(badRequest('unitLabel invalide.'), requestId);
      }
    }
  }

  const updated = await prisma.projectService.update({
    where: { id: itemIdBigInt },
    data,
    include: { service: true },
  });

  return withIdNoStore(
    jsonNoStore({
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
    }),
    requestId
  );
}

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; itemId: string }> }
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

  const { businessId, projectId, itemId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !projectIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await getItem(businessIdBigInt, projectIdBigInt, itemIdBigInt);
  if (!existing) {
    return withIdNoStore(notFound('Élément introuvable.'), requestId);
  }

  await prisma.projectService.delete({ where: { id: itemIdBigInt } });
  return withIdNoStore(jsonNoStore({ ok: true }), requestId);
}
