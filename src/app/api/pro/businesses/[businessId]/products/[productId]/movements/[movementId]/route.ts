import { FinanceType, InventoryMovementType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { upsertLedgerForMovement } from '@/server/services/ledger';
import { parseCentsInput } from '@/lib/money';
import { parseIdOpt } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/products/{productId}/movements/{movementId}
export const PATCH = withBusinessRoute<{ businessId: string; productId: string; movementId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:movements:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;
    const productIdBigInt = parseIdOpt(params?.productId);
    if (!productIdBigInt) return badRequest('productId invalide.');
    const movementIdBigInt = parseIdOpt(params?.movementId);
    if (!movementIdBigInt) return badRequest('movementId invalide.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const movement = await prisma.inventoryMovement.findFirst({
      where: { id: movementIdBigInt, productId: productIdBigInt, businessId: businessIdBigInt },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            purchasePriceCents: true,
            salePriceCents: true,
          },
        },
        financeEntry: {
          select: { id: true, type: true },
        },
      },
    });
    if (!movement) return notFound('Mouvement introuvable.');

    const data: Record<string, unknown> = {};
    const quantityRaw = (body as { quantity?: unknown }).quantity;
    if (quantityRaw !== undefined) {
      if (typeof quantityRaw !== 'number' || !Number.isFinite(quantityRaw)) return badRequest('quantity invalide.');
      const q = Math.trunc(quantityRaw);
      if (movement.type !== InventoryMovementType.ADJUST && q <= 0) return badRequest('quantity doit être > 0 pour IN/OUT.');
      if (movement.type === InventoryMovementType.ADJUST && q === 0) return badRequest('quantity ne peut pas être 0 pour ADJUST.');
      data.quantity = q;
    }

    const reason = (body as { reason?: unknown }).reason;
    if (reason !== undefined) {
      if (typeof reason !== 'string') return badRequest('reason invalide.');
      data.reason = reason;
    }

    const dateRaw = (body as { date?: unknown }).date;
    if (dateRaw !== undefined) {
      if (typeof dateRaw !== 'string' || !dateRaw.trim()) return badRequest('date invalide.');
      const d = new Date(dateRaw);
      if (Number.isNaN(d.getTime())) return badRequest('date invalide.');
      data.date = d;
    }

    const unitCostRaw = (body as { unitCostCents?: unknown }).unitCostCents;
    if (unitCostRaw !== undefined) {
      const parsedValue = parseCentsInput(unitCostRaw);
      const parsed = parsedValue != null ? BigInt(parsedValue) : null;
      if (parsed === null) return badRequest('unitCostCents invalide.');
      data.unitCostCents = parsed;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucun champ valide fourni.');

    const updated = await prisma.$transaction(async (tx) => {
      const updatedMovement = await tx.inventoryMovement.update({
        where: { id: movementIdBigInt },
        data,
      });

      if (movement.financeEntry) {
        const amountPerUnit =
          (data.unitCostCents as bigint | undefined) ??
          updatedMovement.unitCostCents ??
          movement.product.purchasePriceCents ??
          movement.product.salePriceCents ??
          BigInt(0);
        const amount = amountPerUnit * BigInt(Math.abs(updatedMovement.quantity));
        await tx.finance.update({
          where: { inventoryMovementId: movementIdBigInt },
          data: {
            amountCents: amount,
            date: updatedMovement.date,
            inventoryProductId: movement.productId,
            category: movement.financeEntry.type === FinanceType.EXPENSE ? 'INVENTORY' : 'PRODUCT_SALE',
            note: JSON.stringify({
              auto: true,
              source: 'inventory_movement',
              productId: movement.productId.toString(),
              productName: movement.product.name,
              movementId: movementIdBigInt.toString(),
              movementType: updatedMovement.type,
              sku: movement.product.sku,
              quantity: updatedMovement.quantity,
              unitCostCents: amountPerUnit.toString(),
            }),
          },
        });
      }

      await upsertLedgerForMovement(tx, {
        movement: {
          id: updatedMovement.id,
          businessId: updatedMovement.businessId,
          type: updatedMovement.type,
          quantity: updatedMovement.quantity,
          unitCostCents: updatedMovement.unitCostCents ?? null,
          date: updatedMovement.date,
        },
        product: { name: movement.product.name, sku: movement.product.sku },
        createdByUserId: userId,
      });

      return updatedMovement;
    });

    return jsonb({ item: updated }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/products/{productId}/movements/{movementId}
export const DELETE = withBusinessRoute<{ businessId: string; productId: string; movementId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:movements:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const productIdBigInt = parseIdOpt(params?.productId);
    if (!productIdBigInt) return badRequest('productId invalide.');
    const movementIdBigInt = parseIdOpt(params?.movementId);
    if (!movementIdBigInt) return badRequest('movementId invalide.');

    const movement = await prisma.inventoryMovement.findFirst({
      where: { id: movementIdBigInt, productId: productIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!movement) return notFound('Mouvement introuvable.');

    await prisma.$transaction(async (tx) => {
      await tx.finance.deleteMany({ where: { inventoryMovementId: movementIdBigInt } });
      await tx.ledgerEntry.deleteMany({
        where: { sourceType: 'INVENTORY_MOVEMENT', sourceId: movementIdBigInt },
      });
      await tx.inventoryMovement.delete({ where: { id: movementIdBigInt } });
    });

    return jsonbNoContent(requestId);
  }
);

