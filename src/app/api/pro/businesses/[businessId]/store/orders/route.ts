import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

type OrderWithItems = {
  id: bigint; businessId: bigint; orderNumber: string; customerName: string;
  customerEmail: string; customerPhone: string | null; shippingAddress: string | null;
  totalCents: number; status: string; paidAt: Date | null; shippedAt: Date | null;
  trackingNumber: string | null; note: string | null; createdAt: Date;
  items: { id: bigint; quantity: number; unitPriceCents: number; storeProduct: { name: string } }[];
};

function serialize(o: OrderWithItems) {
  return {
    id: o.id.toString(),
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    shippingAddress: o.shippingAddress,
    totalCents: o.totalCents,
    status: o.status,
    paidAt: o.paidAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    trackingNumber: o.trackingNumber,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id.toString(),
      productName: i.storeProduct.name,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  };
}

// GET /api/pro/businesses/{businessId}/store/orders
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const items = await prisma.storeOrder.findMany({
      where: { businessId: ctx.businessId },
      include: {
        items: {
          include: { storeProduct: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);
