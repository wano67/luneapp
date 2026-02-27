import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { DiscountType, InvoiceStatus, RecurringUnit } from '@/generated/prisma';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { resolveServiceUnitPriceCents } from '@/server/services/pricing';
import { computeProjectBillingSummary } from '@/server/billing/summary';

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

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
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; itemId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId, projectId, itemId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !projectIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:recurring-invoice:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const projectService = await prisma.projectService.findFirst({
    where: { id: itemIdBigInt, projectId: projectIdBigInt, project: { businessId: businessIdBigInt } },
    include: { service: true, project: true },
  });
  if (!projectService) return withIdNoStore(notFound('Service introuvable.'), requestId);

  if (projectService.billingUnit !== 'MONTHLY') {
    return withIdNoStore(badRequest('Ce service n’est pas un abonnement mensuel.'), requestId);
  }

  const pricing = resolveServiceUnitPriceCents({
    projectPriceCents: projectService.priceCents ?? null,
    defaultPriceCents: projectService.service?.defaultPriceCents ?? null,
    tjmCents: projectService.service?.tjmCents ?? null,
  });
  if (pricing.missingPrice) {
    return withIdNoStore(badRequest('Prix manquant pour ce service.'), requestId);
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
        where: { projectServiceId: itemIdBigInt },
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
            businessId: businessIdBigInt,
            projectId: projectIdBigInt,
            projectServiceId: itemIdBigInt,
            startDate: now,
            dayOfMonth,
            frequency: RecurringUnit.MONTHLY,
            nextRunAt: targetDate,
            isActive: true,
          },
        });
      }

      const currency = (await computeProjectBillingSummary(businessIdBigInt, projectIdBigInt))?.currency ?? 'EUR';

      const invoice = await tx.invoice.create({
        data: {
          businessId: businessIdBigInt,
          projectId: projectIdBigInt,
          clientId: projectService.project.clientId ?? null,
          createdByUserId: BigInt(userId),
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

    return withIdNoStore(
      jsonNoStore(
        {
          invoice: {
            id: result.id.toString(),
            status: result.status,
            issuedAt: result.issuedAt ? result.issuedAt.toISOString() : null,
          },
        },
        { status: 201 }
      ),
      requestId
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de générer la facture.';
    return withIdNoStore(NextResponse.json({ error: message }, { status: 409 }), requestId);
  }
}
