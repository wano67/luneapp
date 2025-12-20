import { prisma } from '@/server/db/client';

type PricingItem = {
  serviceId: bigint | null;
  label: string;
  quantity: number;
  unitPriceCents: bigint;
  totalCents: bigint;
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
};

function roundPercent(amount: bigint, percent: number) {
  const p = BigInt(percent);
  return (amount * p + BigInt(50)) / BigInt(100);
}

function toNumber(value: bigint | null | undefined) {
  if (value === null || value === undefined) return BigInt(0);
  return value;
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

  const items: PricingItem[] = project.projectServices.map((ps) => {
    const unit = toNumber(ps.priceCents ?? ps.service?.defaultPriceCents ?? null);
    const qty = ps.quantity && ps.quantity > 0 ? ps.quantity : 1;
    const total = unit * BigInt(qty);
    return {
      serviceId: ps.serviceId ?? null,
      label: ps.service?.name ?? ps.service?.code ?? 'Service',
      quantity: qty,
      unitPriceCents: unit,
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
  };
}
