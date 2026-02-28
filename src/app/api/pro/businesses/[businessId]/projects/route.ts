import { prisma } from '@/server/db/client';
import {
  Prisma,
  ProjectStatus,
  ProjectQuoteStatus,
  ProjectDepositStatus,
  TaskStatus,
} from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import {
  buildProjectWhere,
  getProjectCounts,
  mapProjectStatusToScope,
  type ProjectScope,
} from '@/server/queries/projects';
import { resolveServiceUnitPriceCents } from '@/server/services/pricing';
import { pickProjectValueCents } from '@/server/billing/summary';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function parseScope(value: string | null): ProjectScope | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === 'ACTIVE' || upper === 'PLANNED' || upper === 'INACTIVE' || upper === 'ALL') {
    return upper as ProjectScope;
  }
  return null;
}

function applyDiscount(params: {
  unitPriceCents: bigint;
  discountType?: string | null;
  discountValue?: number | null;
}) {
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

// GET /api/pro/businesses/{businessId}/projects
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get('scope');
  const statusParam = searchParams.get('status');
  const status =
    statusParam && Object.values(ProjectStatus).includes(statusParam as ProjectStatus)
      ? (statusParam as ProjectStatus)
      : null;
  const archivedParam = searchParams.get('archived');
  const clientIdParam = searchParams.get('clientId');
  const q = searchParams.get('q')?.trim();
  const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
  const tagReferenceIdParam = searchParams.get('tagReferenceId');

  const clientId = parseIdOpt(clientIdParam);
  const categoryReferenceId = categoryReferenceIdParam ? parseIdOpt(categoryReferenceIdParam) : null;
  if (categoryReferenceIdParam && !categoryReferenceId) {
    return withIdNoStore(badRequest('categoryReferenceId invalide.'), requestId);
  }
  const tagReferenceId = tagReferenceIdParam ? parseIdOpt(tagReferenceIdParam) : null;
  if (tagReferenceIdParam && !tagReferenceId) {
    return withIdNoStore(badRequest('tagReferenceId invalide.'), requestId);
  }

  const scope = parseScope(scopeParam) ?? (status ? mapProjectStatusToScope(status) : null) ?? 'ACTIVE';
  const archivedOverride =
    scope === 'ALL'
      ? archivedParam === 'true'
        ? { archivedAt: { not: null } }
        : archivedParam === 'false'
          ? { archivedAt: null }
          : {}
      : {};
  const includeArchived = scope === 'ALL' ? archivedParam !== 'false' : undefined;

  const baseWhere = buildProjectWhere({
    businessId: businessIdBigInt.toString(),
    scope,
    includeArchived,
  });

  const where: Prisma.ProjectWhereInput = {
    ...baseWhere,
    ...archivedOverride,
    ...(clientId ? { clientId } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    ...(categoryReferenceId ? { categoryReferenceId } : {}),
    ...(tagReferenceId ? { tags: { some: { referenceId: tagReferenceId } } } : {}),
  };

  const [projects, totalCount, counts] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    }),
    prisma.project.count({ where }),
    getProjectCounts({ businessId: businessIdBigInt.toString() }),
  ]);

  const projectIds = projects.map((p) => p.id);
  const billingQuoteIds = projects
    .map((p) => p.billingQuoteId)
    .filter((id): id is bigint => Boolean(id));

  const [billingQuotes, signedQuotes] = await Promise.all([
    billingQuoteIds.length
      ? prisma.quote.findMany({
          where: { id: { in: billingQuoteIds }, businessId: businessIdBigInt, status: 'SIGNED' },
          select: { id: true, projectId: true, totalCents: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.quote.findMany({
          where: { projectId: { in: projectIds }, businessId: businessIdBigInt, status: 'SIGNED' },
          orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, projectId: true, totalCents: true, issuedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const billingQuoteById = new Map<bigint, { totalCents: bigint }>();
  billingQuotes.forEach((quote) => billingQuoteById.set(quote.id, { totalCents: quote.totalCents }));

  const latestSignedByProject = new Map<bigint, { totalCents: bigint }>();
  for (const quote of signedQuotes) {
    if (!latestSignedByProject.has(quote.projectId)) {
      latestSignedByProject.set(quote.projectId, { totalCents: quote.totalCents });
    }
  }
  const serviceRows = projectIds.length
    ? await prisma.projectService.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          projectId: true,
          quantity: true,
          priceCents: true,
          discountType: true,
          discountValue: true,
          service: { select: { defaultPriceCents: true, tjmCents: true } },
        },
      })
    : [];

  const totalsByProject = new Map<bigint, { total: bigint; count: number }>();
  for (const row of serviceRows) {
    const resolved = resolveServiceUnitPriceCents({
      projectPriceCents: row.priceCents ?? null,
      defaultPriceCents: row.service?.defaultPriceCents ?? null,
      tjmCents: row.service?.tjmCents ?? null,
    });
    const quantity = row.quantity && row.quantity > 0 ? row.quantity : 1;
    const finalUnit = applyDiscount({
      unitPriceCents: resolved.unitPriceCents,
      discountType: row.discountType,
      discountValue: row.discountValue,
    });
    const lineTotal = finalUnit * BigInt(quantity);
    const entry = totalsByProject.get(row.projectId) ?? { total: BigInt(0), count: 0 };
    entry.total += lineTotal;
    entry.count += 1;
    totalsByProject.set(row.projectId, entry);
  }

  const progressByProject = new Map<
    bigint,
    { total: number; done: number; open: number; progressPct: number }
  >();

  if (projects.length) {
    const taskRows = await prisma.task.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
      select: { projectId: true, status: true, progress: true },
    });

    const grouped = new Map<bigint, { total: number; done: number; open: number; sum: number }>();
    for (const t of taskRows) {
      if (!t.projectId) continue;
      const bucket = grouped.get(t.projectId) ?? { total: 0, done: 0, open: 0, sum: 0 };
      bucket.total += 1;
      const pct =
        t.status === TaskStatus.DONE ? 100 : t.status === TaskStatus.IN_PROGRESS ? t.progress ?? 0 : 0;
      bucket.sum += pct;
      if (t.status === TaskStatus.DONE) bucket.done += 1;
      else bucket.open += 1;
      grouped.set(t.projectId, bucket);
    }

    for (const [projectId, stats] of grouped.entries()) {
      const progressPct = stats.total ? Math.round(stats.sum / stats.total) : 0;
      progressByProject.set(projectId, { total: stats.total, done: stats.done, open: stats.open, progressPct });
    }
  }

  return jsonb({
    counts,
    totalCount,
    items: projects.map((p) => ({
        id: p.id.toString(),
        businessId: p.businessId.toString(),
        clientId: p.clientId ? p.clientId.toString() : null,
        clientName: p.client?.name ?? null,
        categoryReferenceId: p.categoryReferenceId ? p.categoryReferenceId.toString() : null,
        categoryReferenceName: p.categoryReference?.name ?? null,
        tagReferences: p.tags.map((t) => ({ id: t.reference.id.toString(), name: t.reference.name })),
        name: p.name,
        status: p.status,
        quoteStatus: p.quoteStatus,
        depositStatus: p.depositStatus,
        startedAt: p.startedAt ? p.startedAt.toISOString() : null,
        archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        amountCents: (() => {
          const billingQuote = p.billingQuoteId ? billingQuoteById.get(p.billingQuoteId) : null;
          const latestSigned = latestSignedByProject.get(p.id);
          const serviceTotal = totalsByProject.get(p.id);
          const value = pickProjectValueCents({
            billingQuoteTotal: billingQuote?.totalCents ?? null,
            latestSignedTotal: latestSigned?.totalCents ?? null,
            serviceTotal: serviceTotal?.count ? serviceTotal.total : null,
          });
          return value != null ? value.toString() : null;
        })(),
        progress: progressByProject.get(p.id)?.progressPct ?? 0,
        tasksSummary: progressByProject.get(p.id)
          ? {
              total: progressByProject.get(p.id)!.total,
              open: progressByProject.get(p.id)!.open,
              done: progressByProject.get(p.id)!.done,
              progressPct: progressByProject.get(p.id)!.progressPct,
            }
          : { total: 0, open: 0, done: 0, progressPct: 0 },
      })),
    }, requestId);
});

// POST /api/pro/businesses/{businessId}/projects
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:projects:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string') {
    return withIdNoStore(badRequest('Le nom du projet est requis.'), requestId);
  }

  const name = body.name.trim();
  if (!name) return withIdNoStore(badRequest('Le nom du projet ne peut pas être vide.'), requestId);

  let clientId: bigint | undefined;
  if (body.clientId && typeof body.clientId === 'string') {
    clientId = BigInt(body.clientId);
  }
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!client) {
      return withIdNoStore(badRequest('clientId invalide pour ce business.'), requestId);
    }
  }

  const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'categoryReferenceId');
  const categoryReferenceId =
    categoryProvided && typeof body.categoryReferenceId === 'string' && /^\d+$/.test(body.categoryReferenceId)
      ? BigInt(body.categoryReferenceId)
      : categoryProvided
        ? null
        : undefined;

  const tagProvided = Object.prototype.hasOwnProperty.call(body, 'tagReferenceIds');
  const tagReferenceIds: bigint[] | undefined = tagProvided
    ? Array.from(
        new Set(
          ((Array.isArray(body.tagReferenceIds) ? body.tagReferenceIds : []) as unknown[])
            .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
            .map((id) => BigInt(id))
        )
      )
    : undefined;

  const validated = await validateCategoryAndTags(
    businessIdBigInt,
    categoryReferenceId ?? null,
    tagReferenceIds
  );
  if ('error' in validated) {
    return withIdNoStore(badRequest(validated.error), requestId);
  }

  const status: ProjectStatus =
    typeof body.status === 'string' && Object.values(ProjectStatus).includes(body.status as ProjectStatus)
      ? (body.status as ProjectStatus)
      : ProjectStatus.PLANNED;
  const quoteStatus: ProjectQuoteStatus =
    typeof body.quoteStatus === 'string' && Object.values(ProjectQuoteStatus).includes(body.quoteStatus as ProjectQuoteStatus)
      ? (body.quoteStatus as ProjectQuoteStatus)
      : ProjectQuoteStatus.DRAFT;
  const depositStatus: ProjectDepositStatus =
    typeof body.depositStatus === 'string' && Object.values(ProjectDepositStatus).includes(body.depositStatus as ProjectDepositStatus)
      ? (body.depositStatus as ProjectDepositStatus)
      : ProjectDepositStatus.PENDING;

  const project = await prisma.project.create({
    data: {
      businessId: businessIdBigInt,
      clientId,
      name,
      categoryReferenceId: validated.categoryId ?? undefined,
      tags:
        validated.tagIds.length > 0
          ? {
              create: validated.tagIds.map((id) => ({ referenceId: id })),
            }
          : undefined,
      status,
      quoteStatus,
      depositStatus,
      startDate:
        typeof body.startDate === 'string'
          ? new Date(body.startDate)
          : undefined,
      endDate:
        typeof body.endDate === 'string' ? new Date(body.endDate) : undefined,
    },
  });

  return jsonb(
    {
      item: {
        id: project.id.toString(),
        businessId: project.businessId.toString(),
        clientId: project.clientId ? project.clientId.toString() : null,
        categoryReferenceId: project.categoryReferenceId ? project.categoryReferenceId.toString() : null,
        tagReferences: validated.tagIds.map((id) => ({ id: id.toString() })),
        name: project.name,
        status: project.status,
        quoteStatus: project.quoteStatus,
        depositStatus: project.depositStatus,
        startedAt: project.startedAt ? project.startedAt.toISOString() : null,
        archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
        startDate: project.startDate ? project.startDate.toISOString() : null,
        endDate: project.endDate ? project.endDate.toISOString() : null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    },
    requestId,
    { status: 201 }
  );
  }
);
