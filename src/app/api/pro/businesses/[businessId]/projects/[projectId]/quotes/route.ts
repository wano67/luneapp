import { prisma } from '@/server/db/client';
import { QuoteStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { computeProjectPricing } from '@/server/services/pricing';

// GET /api/pro/businesses/{businessId}/projects/{projectId}/quotes
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('projectId invalide.');
    const projectIdBigInt = BigInt(projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const quotes = await prisma.quote.findMany({
      where: { businessId: businessIdBigInt, projectId: projectIdBigInt },
      orderBy: { createdAt: 'desc' },
      include: { items: { orderBy: { id: 'asc' } } },
    });

    return jsonb({ items: quotes }, requestId);
  }
);

// POST /api/pro/businesses/{businessId}/projects/{projectId}/quotes
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:quotes:create:${ctx.businessId}:${ctx.userId}`,
      limit: 50,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;
    const projectId = params?.projectId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('projectId invalide.');
    const projectIdBigInt = BigInt(projectId);

    const pricing = await computeProjectPricing(businessIdBigInt, projectIdBigInt);
    if (!pricing) return notFound('Projet introuvable.');
    if (pricing.items.length === 0) {
      return badRequest('Cannot create a quote with no billable items. Add services to the project first.');
    }
    if (pricing.missingPriceServices?.length) {
      const names = pricing.missingPriceServices.map((item) => item.label).join(', ');
      return badRequest(`Prix manquant pour les services suivants: ${names}. Definissez un tarif avant de creer un devis.`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          businessId: businessIdBigInt,
          projectId: projectIdBigInt,
          clientId: pricing.clientId ?? undefined,
          createdByUserId: userId,
          status: QuoteStatus.DRAFT,
          depositPercent: pricing.depositPercent,
          currency: pricing.currency,
          totalCents: pricing.totalCents,
          depositCents: pricing.depositCents,
          balanceCents: pricing.balanceCents,
          expiresAt,
          items: {
            create: pricing.items.map((item) => ({
              serviceId: item.serviceId ?? undefined,
              label: item.label,
              description: item.description ?? undefined,
              discountType: item.discountType ?? 'NONE',
              discountValue: item.discountValue ?? undefined,
              originalUnitPriceCents: item.originalUnitPriceCents ?? undefined,
              unitLabel: item.unitLabel ?? undefined,
              billingUnit: item.billingUnit ?? 'ONE_OFF',
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              totalCents: item.totalCents,
            })),
          },
        },
        include: { items: true },
      });
      return created;
    });

    const basePath = `/api/pro/businesses/${businessIdBigInt}/quotes/${quote.id}`;

    return jsonbCreated(
      {
        item: quote,
        pdfUrl: `${basePath}/pdf`,
        downloadUrl: `${basePath}/pdf`,
      },
      requestId
    );
  }
);
