import { prisma } from '@/server/db/client';
import type { BillingUnit, DiscountType } from '@/generated/prisma';

type PricingItem = {
  serviceId: bigint | null;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: bigint;
  originalUnitPriceCents?: bigint | null;
  discountType?: DiscountType;
  discountValue?: number | null;
  billingUnit?: BillingUnit;
  unitLabel?: string | null;
  totalCents: bigint;
};

export type PriceSource = 'project' | 'default' | 'tjm' | 'missing';

export type PriceResolution = {
  unitPriceCents: bigint;
  source: PriceSource;
  missingPrice: boolean;
};

export type ProjectPricing = {
  businessId: bigint;
  projectId: bigint;
  clientId: bigint | null;
  currency: string;
  depositPercent: number;
  totalCents: bigint;
  depositCents: bigint;
  balanceCents: bigint;
  items: PricingItem[];
  projectName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  missingPriceServices?: Array<{ serviceId: bigint | null; label: string }>;
};

function roundPercent(amount: bigint, percent: number) {
  const p = BigInt(percent);
  return (amount * p + BigInt(50)) / BigInt(100);
}

function applyDiscount(params: {
  unitPriceCents: bigint;
  discountType?: DiscountType | null;
  discountValue?: number | null;
}) {
  const discountType = params.discountType ?? 'NONE';
  const discountValue = params.discountValue ?? null;
  if (discountType === 'PERCENT' && discountValue != null && Number.isFinite(discountValue)) {
    const bounded = Math.min(100, Math.max(0, Math.trunc(discountValue)));
    const final = (params.unitPriceCents * BigInt(100 - bounded)) / BigInt(100);
    return { finalUnit: final, originalUnit: params.unitPriceCents, discountValue: bounded };
  }
  if (discountType === 'AMOUNT' && discountValue != null && Number.isFinite(discountValue)) {
    const bounded = Math.max(0, Math.trunc(discountValue));
    const final = params.unitPriceCents - BigInt(bounded);
    return { finalUnit: final > BigInt(0) ? final : BigInt(0), originalUnit: params.unitPriceCents, discountValue: bounded };
  }
  return { finalUnit: params.unitPriceCents, originalUnit: null, discountValue: null };
}

export function resolveServiceUnitPriceCents(params: {
  projectPriceCents?: bigint | null;
  defaultPriceCents?: bigint | null;
  tjmCents?: bigint | null;
}): PriceResolution {
  if (params.projectPriceCents !== null && params.projectPriceCents !== undefined) {
    return { unitPriceCents: params.projectPriceCents, source: 'project', missingPrice: false };
  }
  if (params.defaultPriceCents !== null && params.defaultPriceCents !== undefined) {
    return { unitPriceCents: params.defaultPriceCents, source: 'default', missingPrice: false };
  }
  if (params.tjmCents !== null && params.tjmCents !== undefined) {
    return { unitPriceCents: params.tjmCents, source: 'tjm', missingPrice: false };
  }
  return { unitPriceCents: BigInt(0), source: 'missing', missingPrice: true };
}

export async function computeProjectPricing(businessId: bigint, projectId: bigint): Promise<ProjectPricing | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, businessId },
    include: {
      projectServices: { include: { service: true }, orderBy: { position: 'asc' } },
      client: { select: { id: true, name: true, email: true } },
      business: { select: { settings: { select: { defaultDepositPercent: true } } } },
    },
  });
  if (!project) return null;

  const missingPriceServices: Array<{ serviceId: bigint | null; label: string }> = [];
  const items: PricingItem[] = project.projectServices.map((ps) => {
    const label =
      ps.titleOverride?.trim() ||
      ps.service?.name ||
      ps.service?.code ||
      (ps.serviceId ? `Service ${ps.serviceId.toString()}` : 'Service');
    const resolved = resolveServiceUnitPriceCents({
      projectPriceCents: ps.priceCents ?? null,
      defaultPriceCents: ps.service?.defaultPriceCents ?? null,
      tjmCents: ps.service?.tjmCents ?? null,
    });
    if (resolved.missingPrice) {
      missingPriceServices.push({ serviceId: ps.serviceId ?? null, label });
    }
    const qty = ps.quantity && ps.quantity > 0 ? ps.quantity : 1;
    const discount = applyDiscount({
      unitPriceCents: resolved.unitPriceCents,
      discountType: ps.discountType ?? 'NONE',
      discountValue: ps.discountValue ?? null,
    });
    const total = discount.finalUnit * BigInt(qty);
    const unitLabel =
      ps.unitLabel ?? (ps.billingUnit === 'MONTHLY' ? '/mois' : null);
    return {
      serviceId: ps.serviceId ?? null,
      label,
      description: ps.description ?? ps.notes ?? null,
      quantity: qty,
      unitPriceCents: discount.finalUnit,
      originalUnitPriceCents: discount.originalUnit,
      discountType: ps.discountType ?? 'NONE',
      discountValue: discount.discountValue,
      billingUnit: ps.billingUnit ?? 'ONE_OFF',
      unitLabel,
      totalCents: total,
    };
  });

  const totalCents = items.reduce((sum, item) => sum + item.totalCents, BigInt(0));
  const rawDepositPercent = project.business?.settings?.defaultDepositPercent;
  const depositPercent = Number.isFinite(rawDepositPercent)
    ? Math.min(100, Math.max(0, Number(rawDepositPercent)))
    : 0;
  const depositCents = roundPercent(totalCents, depositPercent);
  const balanceCents = totalCents - depositCents;

  return {
    businessId,
    projectId,
    clientId: project.clientId ?? null,
    currency: 'EUR',
    depositPercent,
    totalCents,
    depositCents,
    balanceCents,
    items,
    projectName: project.name,
    clientName: project.client?.name ?? null,
    clientEmail: project.client?.email ?? null,
    ...(missingPriceServices.length ? { missingPriceServices } : {}),
  };
}
