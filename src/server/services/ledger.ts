import {
  InventoryMovementType,
  LedgerSourceType,
  Prisma,
} from '@/generated/prisma/client';

type TxClient = Prisma.TransactionClient;

async function getSettings(tx: TxClient, businessId: bigint) {
  return tx.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });
}

function sumBigInt(values: bigint[]) {
  return values.reduce((acc, v) => acc + v, BigInt(0));
}

async function replaceLines(
  tx: TxClient,
  entryId: bigint,
  lines: Array<{
    accountCode: string;
    accountName?: string | null;
    debitCents?: bigint;
    creditCents?: bigint;
    metadata?: Prisma.InputJsonValue;
  }>
) {
  await tx.ledgerLine.deleteMany({ where: { entryId } });
  await tx.ledgerLine.createMany({
    data: lines.map((line) => ({
      entryId,
      accountCode: line.accountCode,
      accountName: line.accountName ?? null,
      debitCents: line.debitCents ?? undefined,
      creditCents: line.creditCents ?? undefined,
      metadata: line.metadata ?? undefined,
    })),
  });
}

function ensureBalanced(lines: Array<{ debitCents?: bigint | null; creditCents?: bigint | null }>) {
  const debit = sumBigInt(lines.map((l) => l.debitCents ?? BigInt(0)));
  const credit = sumBigInt(lines.map((l) => l.creditCents ?? BigInt(0)));
  if (debit !== credit) {
    throw new Error(`Ledger entry not balanced (debit=${debit.toString()} credit=${credit.toString()})`);
  }
}

export async function upsertLedgerForMovement(
  tx: TxClient,
  params: {
    movement: {
      id: bigint;
      businessId: bigint;
      type: InventoryMovementType;
      quantity: number;
      unitCostCents: bigint | null;
      date: Date;
    };
    product: { name: string; sku: string };
    createdByUserId?: bigint | null;
  }
) {
  if (params.movement.type !== InventoryMovementType.IN || !params.movement.unitCostCents) {
    await tx.ledgerEntry.deleteMany({
      where: { sourceType: LedgerSourceType.INVENTORY_MOVEMENT, sourceId: params.movement.id },
    });
    return;
  }
  const settings = await getSettings(tx, params.movement.businessId);
  const amount = params.movement.unitCostCents * BigInt(Math.abs(params.movement.quantity));
  const entry = await tx.ledgerEntry.upsert({
    where: { sourceType_sourceId: { sourceType: LedgerSourceType.INVENTORY_MOVEMENT, sourceId: params.movement.id } },
    create: {
      businessId: params.movement.businessId,
      date: params.movement.date,
      memo: `Achat stock ${params.product.sku}`,
      sourceType: LedgerSourceType.INVENTORY_MOVEMENT,
      sourceId: params.movement.id,
      createdByUserId: params.createdByUserId ?? null,
    },
    update: { date: params.movement.date, memo: `Achat stock ${params.product.sku}` },
  });

  const lines = [
    { accountCode: settings.accountInventoryCode, debitCents: amount },
    { accountCode: settings.accountCashCode, creditCents: amount },
  ];
  ensureBalanced(lines);
  await replaceLines(tx, entry.id, lines);
}

async function getAverageCost(tx: TxClient, businessId: bigint, productId: bigint, fallback: bigint) {
  const rows = await tx.inventoryMovement.findMany({
    where: {
      businessId,
      productId,
      type: { in: [InventoryMovementType.IN, InventoryMovementType.ADJUST] },
      unitCostCents: { not: null },
      quantity: { gt: 0 },
    },
    select: { quantity: true, unitCostCents: true },
  });
  let totalQty = BigInt(0);
  let totalCost = BigInt(0);
  for (const r of rows) {
    totalQty += BigInt(r.quantity);
    totalCost += (r.unitCostCents ?? BigInt(0)) * BigInt(r.quantity);
  }
  if (totalQty === BigInt(0)) return fallback;
  return totalCost / totalQty;
}

export async function createLedgerForInvoiceConsumption(
  tx: TxClient,
  params: {
    invoiceId: bigint;
    businessId: bigint;
    projectId: bigint;
    items: Array<{ productId: bigint; quantity: number; unitCostHint?: bigint | null }>;
    createdByUserId?: bigint | null;
    date?: Date;
  }
) {
  const existing = await tx.ledgerEntry.findUnique({
    where: { sourceType_sourceId: { sourceType: LedgerSourceType.INVOICE_STOCK_CONSUMPTION, sourceId: params.invoiceId } },
    include: { lines: true },
  });
  if (existing) return existing;

  const settings = await getSettings(tx, params.businessId);

  let totalAmount = BigInt(0);
  const perProduct: Array<{ productId: bigint; amount: bigint; quantity: number }> = [];
  for (const item of params.items) {
    const product = await tx.product.findUnique({ where: { id: item.productId }, select: { purchasePriceCents: true } });
    const fallback = product?.purchasePriceCents ?? BigInt(0);
    const unitCost = await getAverageCost(tx, params.businessId, item.productId, item.unitCostHint ?? fallback);
    const amount = unitCost * BigInt(Math.abs(item.quantity));
    totalAmount += amount;
    perProduct.push({ productId: item.productId, amount, quantity: item.quantity });
  }

  if (totalAmount === BigInt(0)) return null;

  const entry = await tx.ledgerEntry.create({
    data: {
      businessId: params.businessId,
      date: params.date ?? new Date(),
      memo: 'Sortie stock facturation (COGS)',
      sourceType: LedgerSourceType.INVOICE_STOCK_CONSUMPTION,
      sourceId: params.invoiceId,
      createdByUserId: params.createdByUserId ?? null,
    },
  });

  const lines = [
    { accountCode: settings.accountCogsCode, debitCents: totalAmount },
    { accountCode: settings.accountInventoryCode, creditCents: totalAmount },
  ];
  ensureBalanced(lines);
  await replaceLines(tx, entry.id, lines);
  return entry;
}
