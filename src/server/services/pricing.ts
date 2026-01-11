import { prisma } from '@/server/db/client';

type PricingItem = {
  serviceId: bigint | null;
  label: string;
  quantity: number;
  unitPriceCents: bigint;
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
      projectServices: { include: { service: true } },
      client: { select: { id: true, name: true, email: true } },
      business: { select: { id: true } },
    },
  });
  if (!project) return null;

  const missingPriceServices: Array<{ serviceId: bigint | null; label: string }> = [];
  const items: PricingItem[] = project.projectServices.map((ps) => {
    const label =
      ps.service?.name ??
      ps.service?.code ??
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
    const total = resolved.unitPriceCents * BigInt(qty);
    return {
      serviceId: ps.serviceId ?? null,
      label,
      quantity: qty,
      unitPriceCents: resolved.unitPriceCents,
      totalCents: total,
    };
  });

  const totalCents = items.reduce((sum, item) => sum + item.totalCents, BigInt(0));
  const depositPercent = 30;
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
