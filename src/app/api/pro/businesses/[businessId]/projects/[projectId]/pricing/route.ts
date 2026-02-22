import { NextRequest, NextResponse } from 'next/server';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { getRequestId, badRequest, unauthorized, forbidden, notFound, withRequestId } from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import { computeProjectPricing } from '@/server/services/pricing';

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

function serializePricing(pricing: Awaited<ReturnType<typeof computeProjectPricing>>) {
  if (!pricing) return null;
  return {
    businessId: pricing.businessId.toString(),
    projectId: pricing.projectId.toString(),
    clientId: pricing.clientId ? pricing.clientId.toString() : null,
    currency: pricing.currency,
    depositPercent: pricing.depositPercent,
    totalCents: pricing.totalCents.toString(),
    depositCents: pricing.depositCents.toString(),
    balanceCents: pricing.balanceCents.toString(),
    projectName: pricing.projectName ?? null,
    clientName: pricing.clientName ?? null,
    clientEmail: pricing.clientEmail ?? null,
    items: pricing.items.map((item) => ({
      serviceId: item.serviceId ? item.serviceId.toString() : null,
      label: item.label,
      description: item.description ?? null,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents.toString(),
      originalUnitPriceCents: item.originalUnitPriceCents ? item.originalUnitPriceCents.toString() : null,
      discountType: item.discountType ?? 'NONE',
      discountValue: item.discountValue ?? null,
      billingUnit: item.billingUnit ?? 'ONE_OFF',
      unitLabel: item.unitLabel ?? null,
      totalCents: item.totalCents.toString(),
    })),
  };
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}/pricing
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, projectId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const pricing = await computeProjectPricing(businessIdBigInt, projectIdBigInt);
  if (!pricing) return withIdNoStore(notFound('Projet introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ pricing: serializePricing(pricing) }), requestId);
}
