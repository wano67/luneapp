import { FinanceType, InventoryMovementSource, InventoryMovementType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { upsertLedgerForMovement } from '@/server/services/ledger';
import { parseCentsInput } from '@/lib/money';
import { parseIdOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/products/{productId}/movements
export const GET = withBusinessRoute<{ businessId: string; productId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const productIdBigInt = parseIdOpt(params?.productId);
    if (!productIdBigInt) return badRequest('productId invalide.');

    const product = await prisma.product.findFirst({
      where: { id: productIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!product) return notFound('Produit introuvable.');

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: productIdBigInt, businessId: businessIdBigInt },
      orderBy: { date: 'desc' },
    });

    return jsonb({ items: movements }, requestId);
  }
);

// POST /api/pro/businesses/{businessId}/products/{productId}/movements
export const POST = withBusinessRoute<{ businessId: string; productId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:movements:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;
    const productIdBigInt = parseIdOpt(params?.productId);
    if (!productIdBigInt) return badRequest('productId invalide.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const typeRaw = (body as { type?: unknown }).type;
    if (typeof typeRaw !== 'string' || !Object.values(InventoryMovementType).includes(typeRaw as InventoryMovementType)) {
      return badRequest('type invalide.');
    }
    const type = typeRaw as InventoryMovementType;

    const sourceRaw = (body as { source?: unknown }).source;
    const source =
      typeof sourceRaw === 'string' && Object.values(InventoryMovementSource).includes(sourceRaw as InventoryMovementSource)
        ? (sourceRaw as InventoryMovementSource)
        : InventoryMovementSource.MANUAL;

    const quantityRaw = (body as { quantity?: unknown }).quantity;
    if (typeof quantityRaw !== 'number' || !Number.isFinite(quantityRaw)) return badRequest('quantity invalide.');
    if (type !== 'ADJUST' && quantityRaw <= 0) return badRequest('quantity doit être > 0 pour IN/OUT.');
    if (type === 'ADJUST' && quantityRaw === 0) return badRequest('quantity ne peut pas être 0 pour ADJUST.');
    const quantity = Math.trunc(quantityRaw);

    const unitCostRaw = (body as { unitCostCents?: unknown }).unitCostCents;
    const unitCostParsed = unitCostRaw !== undefined ? parseCentsInput(unitCostRaw) : null;
    const unitCostCents = unitCostParsed != null ? BigInt(unitCostParsed) : null;
    if (unitCostRaw !== undefined && unitCostCents === null) return badRequest('unitCostCents invalide.');

    const reason = typeof (body as { reason?: unknown }).reason === 'string' ? (body as { reason: string }).reason : null;
    const dateRaw = (body as { date?: unknown }).date;
    const date = typeof dateRaw === 'string' && dateRaw.trim() ? new Date(dateRaw) : new Date();
    if (Number.isNaN(date.getTime())) return badRequest('date invalide.');

    const createFinanceEntry = (body as { createFinanceEntry?: unknown }).createFinanceEntry === true;
    const financeTypeRaw = (body as { financeType?: unknown }).financeType;
    const financeType =
      financeTypeRaw === 'INCOME' || financeTypeRaw === 'EXPENSE'
        ? (financeTypeRaw as FinanceType)
        : type === 'IN'
          ? FinanceType.EXPENSE
          : type === 'OUT'
            ? FinanceType.INCOME
            : null;

    const product = await prisma.product.findFirst({
      where: { id: productIdBigInt, businessId: businessIdBigInt },
    });
    if (!product) return notFound('Produit introuvable.');

    const movement = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryMovement.create({
        data: {
          businessId: businessIdBigInt,
          productId: productIdBigInt,
          type,
          source,
          quantity,
          unitCostCents: unitCostCents ?? undefined,
          reason: reason ?? undefined,
          date,
          createdByUserId: userId,
        },
      });

      if (createFinanceEntry && financeType) {
        const amountPerUnit =
          unitCostCents ??
          product.purchasePriceCents ??
          product.salePriceCents ??
          BigInt(0);
        const amount = amountPerUnit * BigInt(Math.abs(quantity));
        await tx.finance.upsert({
          where: { inventoryMovementId: created.id },
          create: {
            businessId: businessIdBigInt,
            type: financeType,
            amountCents: amount,
            category: financeType === FinanceType.EXPENSE ? 'INVENTORY' : 'PRODUCT_SALE',
            date,
            inventoryMovementId: created.id,
            inventoryProductId: productIdBigInt,
            note: JSON.stringify({
              auto: true,
              source: 'inventory_movement',
              productId: productIdBigInt.toString(),
              productName: product.name,
              movementId: created.id.toString(),
              movementType: type,
              sku: product.sku,
              quantity,
              unitCostCents: amountPerUnit.toString(),
            }),
          },
          update: {
            type: financeType,
            amountCents: amount,
            category: financeType === FinanceType.EXPENSE ? 'INVENTORY' : 'PRODUCT_SALE',
            date,
            inventoryProductId: productIdBigInt,
            note: JSON.stringify({
              auto: true,
              source: 'inventory_movement',
              productId: productIdBigInt.toString(),
              productName: product.name,
              movementId: created.id.toString(),
              movementType: type,
              sku: product.sku,
              quantity,
              unitCostCents: amountPerUnit.toString(),
            }),
          },
        });
      }

      await upsertLedgerForMovement(tx, {
        movement: {
          id: created.id,
          businessId: businessIdBigInt,
          type,
          quantity,
          unitCostCents,
          date,
        },
        product: { name: product.name, sku: product.sku },
        createdByUserId: userId,
      });

      return created;
    });

    return jsonbCreated({ item: movement }, requestId);
  }
);
