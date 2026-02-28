import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { DiscountType, InvoiceStatus, RecurringUnit } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { resolveServiceUnitPriceCents } from '@/server/services/pricing';
import { computeProjectBillingSummary } from '@/server/billing/summary';

function clampDayOfMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
}

function addMonth(base: Date, months: number, dayOfMonth: number) {
  const year = base.getFullYear();
  const month = base.getMonth() + months;
  const safeDay = clampDayOfMonth(year, month, dayOfMonth);
  return new Date(year, month, safeDay, 12, 0, 0, 0);
}

function applyDiscount(params: { unitPriceCents: bigint; discountType?: DiscountType | null; discountValue?: number | null }) {
  const discountType = params.discountType ?? 'NONE';
  const discountValue = params.discountValue ?? null;
  if (discountType === 'PERCENT' && discountValue != null && Number.isFinite(discountValue)) {
    const bounded = Math.min(100, Math.max(0, Math.trunc(discountValue)));
    return (params.unitPriceCents * BigInt(100 - bounded)) / BigInt(100);
  }
  if (discountType === 'AMOUNT' && discountValue != null && Number.isFinite(discountValue)) {
    const bounded = Math.max(0, Math.trunc(discountValue));
    const final = params.unitPriceCents - BigInt(bounded);
    return final > BigInt(0) ? final : BigInt(0);
  }
  return params.unitPriceCents;
}

// POST /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}/recurring-invoices
export const POST = withBusinessRoute<{ businessId: string; projectId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-services:recurring-invoice:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);
    const itemId = parseId(params.itemId);

    const projectService = await prisma.projectService.findFirst({
      where: { id: itemId, projectId, project: { businessId: ctx.businessId } },
      include: { service: true, project: true },
    });
    if (!projectService) return notFound('Service introuvable.');

    if (projectService.billingUnit !== 'MONTHLY') {
      return badRequest('Ce service n\u2019est pas un abonnement mensuel.');
    }

    const pricing = resolveServiceUnitPriceCents({
      projectPriceCents: projectService.priceCents ?? null,
      defaultPriceCents: projectService.service?.defaultPriceCents ?? null,
      tjmCents: projectService.service?.tjmCents ?? null,
    });
    if (pricing.missingPrice) {
      return badRequest('Prix manquant pour ce service.');
    }

    const quantity = projectService.quantity && projectService.quantity > 0 ? projectService.quantity : 1;
    const unitPriceCents = applyDiscount({
      unitPriceCents: pricing.unitPriceCents,
      discountType: projectService.discountType ?? 'NONE',
      discountValue: projectService.discountValue ?? null,
    });
    const totalCents = unitPriceCents * BigInt(quantity);

    const label =
      projectService.titleOverride?.trim() ||
      projectService.service?.name ||
      projectService.service?.code ||
      `Service ${projectService.serviceId.toString()}`;
    const description = projectService.description ?? projectService.notes ?? null;
    const unitLabel = projectService.unitLabel ?? '/mois';

    const now = new Date();

    try {
      const result = await prisma.$transaction(async (tx) => {
        let rule = await tx.projectServiceRecurringRule.findFirst({
          where: { projectServiceId: itemId },
        });

        const dayOfMonth = rule?.dayOfMonth ?? now.getDate();
        const targetDate = rule?.nextRunAt ?? addMonth(now, 1, dayOfMonth);

        if (rule?.lastInvoicedAt) {
          const last = rule.lastInvoicedAt;
          if (last.getFullYear() === targetDate.getFullYear() && last.getMonth() === targetDate.getMonth()) {
            throw new Error('Une facture est déjà planifiée pour ce mois.');
          }
        }

        if (!rule) {
          rule = await tx.projectServiceRecurringRule.create({
            data: {
              businessId: ctx.businessId,
              projectId,
              projectServiceId: itemId,
              startDate: now,
              dayOfMonth,
              frequency: RecurringUnit.MONTHLY,
              nextRunAt: targetDate,
              isActive: true,
            },
          });
        }

        const currency = (await computeProjectBillingSummary(ctx.businessId, projectId))?.currency ?? 'EUR';

        const invoice = await tx.invoice.create({
          data: {
            businessId: ctx.businessId,
            projectId,
            clientId: projectService.project.clientId ?? null,
            createdByUserId: ctx.userId,
            status: InvoiceStatus.DRAFT,
            number: null,
            depositPercent: 0,
            currency,
            totalCents,
            depositCents: BigInt(0),
            balanceCents: totalCents,
            issuedAt: targetDate,
          },
        });

        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            serviceId: projectService.serviceId,
            label,
            description,
            quantity,
            unitPriceCents,
            originalUnitPriceCents: projectService.discountType === 'NONE' ? null : pricing.unitPriceCents,
            discountType: projectService.discountType ?? 'NONE',
            discountValue: projectService.discountValue ?? null,
            billingUnit: projectService.billingUnit ?? 'MONTHLY',
            unitLabel,
            totalCents,
          },
        });

        const nextRunAt = addMonth(targetDate, 1, dayOfMonth);
        await tx.projectServiceRecurringRule.update({
          where: { id: rule.id },
          data: { lastInvoicedAt: targetDate, nextRunAt },
        });

        return invoice;
      });

      return jsonbCreated(
        {
          invoice: {
            id: result.id,
            status: result.status,
            issuedAt: result.issuedAt,
          },
        },
        ctx.requestId
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de générer la facture.';
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }
);
