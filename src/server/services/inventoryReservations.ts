import {
  InventoryMovementSource,
  InventoryMovementType,
  InventoryReservationStatus,
  Prisma,
} from '@/generated/prisma/client';

type TxClient = Prisma.TransactionClient;

type InvoiceWithItems = Prisma.InvoiceGetPayload<{
  include: { items: true };
}>;

type ReservationWithItems = Prisma.InventoryReservationGetPayload<{
  include: { items: true };
}>;

function aggregateInvoiceItems(invoice: InvoiceWithItems) {
  const aggregates = new Map<bigint, { quantity: number; unitPriceCents?: bigint | null }>();
  for (const item of invoice.items) {
    if (!item.productId) continue;
    const existing = aggregates.get(item.productId) ?? { quantity: 0, unitPriceCents: null };
    existing.quantity += item.quantity;
    existing.unitPriceCents = item.unitPriceCents ?? existing.unitPriceCents;
    aggregates.set(item.productId, existing);
  }
  return Array.from(aggregates.entries()).map(([productId, value]) => ({
    productId,
    quantity: value.quantity,
    unitPriceCents: value.unitPriceCents ?? null,
  }));
}

export async function upsertReservationFromInvoice(
  tx: TxClient,
  invoice: InvoiceWithItems
): Promise<ReservationWithItems | null> {
  const items = aggregateInvoiceItems(invoice);
  if (items.length === 0) {
    await tx.inventoryReservation.updateMany({
      where: { invoiceId: invoice.id },
      data: { status: InventoryReservationStatus.RELEASED },
    });
    return null;
  }

  const reservation = await tx.inventoryReservation.upsert({
    where: { invoiceId: invoice.id },
    create: {
      businessId: invoice.businessId,
      invoiceId: invoice.id,
      status: InventoryReservationStatus.ACTIVE,
    },
    update: { status: InventoryReservationStatus.ACTIVE },
  });

  await tx.inventoryReservationItem.deleteMany({ where: { reservationId: reservation.id } });
  await tx.inventoryReservationItem.createMany({
    data: items.map((item) => ({
      reservationId: reservation.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents ?? undefined,
    })),
  });

  return tx.inventoryReservation.findUnique({
    where: { id: reservation.id },
    include: { items: true },
  });
}

export async function releaseReservation(tx: TxClient, invoiceId: bigint) {
  await tx.inventoryReservation.updateMany({
    where: { invoiceId },
    data: { status: InventoryReservationStatus.RELEASED },
  });
}

export async function consumeReservation(
  tx: TxClient,
  params: { invoice: InvoiceWithItems; userId: bigint }
): Promise<ReservationWithItems | null> {
  const existing = await tx.inventoryReservation.findUnique({
    where: { invoiceId: params.invoice.id },
    include: { items: true },
  });

  const reservation =
    existing?.status === InventoryReservationStatus.ACTIVE && existing.items.length
      ? existing
      : await upsertReservationFromInvoice(tx, params.invoice);

  if (!reservation) return null;
  if (reservation.status === InventoryReservationStatus.CONSUMED) return reservation;
  if (!reservation.items.length) {
    await tx.inventoryReservation.update({
      where: { id: reservation.id },
      data: { status: InventoryReservationStatus.CONSUMED },
    });
    return reservation;
  }

  const date = params.invoice.paidAt ?? new Date();
  for (const item of reservation.items) {
    await tx.inventoryMovement.create({
      data: {
        businessId: params.invoice.businessId,
        productId: item.productId,
        type: InventoryMovementType.OUT,
        source: InventoryMovementSource.SALE,
        quantity: item.quantity,
        unitCostCents: item.unitPriceCents ?? undefined,
        date,
        createdByUserId: params.userId,
      },
    });
  }

  return tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { status: InventoryReservationStatus.CONSUMED },
    include: { items: true },
  });
}
