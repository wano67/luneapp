import { prisma } from '@/server/db/client';
import {
  BusinessReferenceType,
  ProjectDepositStatus,
  ProjectQuoteStatus,
  ProjectStatus,
} from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { computeProjectBillingSummary } from '@/server/billing/summary';

function parseIsoDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

type BillingSummary = NonNullable<Awaited<ReturnType<typeof computeProjectBillingSummary>>>;

function serializeBillingSummary(summary: BillingSummary | null) {
  if (!summary) return null;
  return {
    source: summary.source,
    referenceQuoteId: summary.referenceQuoteId ? summary.referenceQuoteId.toString() : null,
    currency: summary.currency,
    plannedValueCents: summary.plannedValueCents.toString(),
    totalCents: summary.totalCents.toString(),
    depositPercent: summary.depositPercent,
    depositCents: summary.depositCents.toString(),
    balanceCents: summary.balanceCents.toString(),
    alreadyInvoicedCents: summary.alreadyInvoicedCents.toString(),
    alreadyPaidCents: summary.alreadyPaidCents.toString(),
    remainingToCollectCents: summary.remainingToCollectCents.toString(),
    remainingToInvoiceCents: summary.remainingToInvoiceCents.toString(),
    remainingCents: summary.remainingCents.toString(),
  };
}

function serializeProject(
  project: {
    id: bigint;
    businessId: bigint;
    clientId: bigint | null;
    name: string;
    status: ProjectStatus;
    quoteStatus: ProjectQuoteStatus;
    depositStatus: ProjectDepositStatus;
    depositPaidAt: Date | null;
    billingQuoteId?: bigint | null;
    startedAt: Date | null;
    archivedAt: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    prestationsText?: string | null;
    createdAt: Date;
    updatedAt: Date;
    categoryReferenceId?: bigint | null;
    categoryReference?: { id: bigint; name: string | null } | null;
    tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
    client?: { id: bigint; name: string | null } | null;
    _count?: { tasks: number; projectServices: number; interactions: number };
    projectServices?: {
      id: bigint;
      projectId: bigint;
      serviceId: bigint;
      quantity: number;
      priceCents: bigint | null;
      notes: string | null;
      createdAt: Date;
      service: { id: bigint; code: string; name: string; type: string | null; defaultPriceCents: bigint | null };
    }[];
    tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  },
  opts?: { billingSummary?: BillingSummary | null; valueCents?: bigint | null }
) {
  return {
    id: project.id.toString(),
    businessId: project.businessId.toString(),
    clientId: project.clientId ? project.clientId.toString() : null,
    clientName: project.client?.name ?? null,
    client: project.client ? { id: project.client.id.toString(), name: project.client.name } : null,
    name: project.name,
    categoryReferenceId: project.categoryReferenceId ? project.categoryReferenceId.toString() : null,
    categoryReferenceName: project.categoryReference?.name ?? null,
    tagReferences: project.tags
      ? project.tags.map((tag) => ({
          id: tag.reference.id.toString(),
          name: tag.reference.name,
        }))
      : [],
    status: project.status,
    quoteStatus: project.quoteStatus,
    depositStatus: project.depositStatus,
    depositPaidAt: project.depositPaidAt ? project.depositPaidAt.toISOString() : null,
    billingQuoteId: project.billingQuoteId ? project.billingQuoteId.toString() : null,
    startedAt: project.startedAt ? project.startedAt.toISOString() : null,
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    endDate: project.endDate ? project.endDate.toISOString() : null,
    prestationsText: project.prestationsText ?? null,
    billingSummary: opts?.billingSummary ? serializeBillingSummary(opts.billingSummary) : null,
    valueCents: opts?.valueCents != null ? opts.valueCents.toString() : null,
    counts: project._count
      ? {
          tasks: project._count.tasks,
          projectServices: project._count.projectServices,
          interactions: project._count.interactions,
        }
      : undefined,
    projectServices: project.projectServices
      ? project.projectServices.map((ps) => ({
          id: ps.id.toString(),
          projectId: ps.projectId.toString(),
          serviceId: ps.serviceId.toString(),
          quantity: ps.quantity,
          priceCents: ps.priceCents?.toString() ?? null,
          notes: ps.notes,
          createdAt: ps.createdAt.toISOString(),
          service: {
            id: ps.service.id.toString(),
            code: ps.service.code,
            name: ps.service.name,
            type: ps.service.type,
            defaultPriceCents: ps.service.defaultPriceCents?.toString() ?? null,
          },
        }))
      : undefined,
    tasksSummary: project.tasksSummary,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

async function validateCategoryAndTags(
  businessId: bigint,
  categoryReferenceId: bigint | null,
  tagReferenceIds?: bigint[]
): Promise<{ categoryId: bigint | null; tagIds: bigint[] } | { error: string }> {
  if (categoryReferenceId) {
    const category = await prisma.businessReference.findFirst({
      where: {
        id: categoryReferenceId,
        businessId,
        type: BusinessReferenceType.CATEGORY,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!category) return { error: 'categoryReferenceId invalide pour ce business.' };
  }

  let tagIds: bigint[] = [];
  if (tagReferenceIds && tagReferenceIds.length) {
    const tags = await prisma.businessReference.findMany({
      where: {
        id: { in: tagReferenceIds },
        businessId,
        type: BusinessReferenceType.TAG,
        isArchived: false,
      },
      select: { id: true },
    });
    if (tags.length !== tagReferenceIds.length) {
      return { error: 'tagReferenceIds invalides pour ce business.' };
    }
    tagIds = tags.map((t) => t.id);
  }

  return { categoryId: categoryReferenceId, tagIds };
}

function isValidStatus(status: unknown): status is ProjectStatus {
  return typeof status === 'string' && Object.values(ProjectStatus).includes(status as ProjectStatus);
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('projectId invalide.');
    const projectIdBigInt = BigInt(projectId);

    const [project, taskRows] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectIdBigInt, businessId: businessIdBigInt },
        include: {
          client: { select: { id: true, name: true } },
          categoryReference: { select: { id: true, name: true } },
          tags: { include: { reference: { select: { id: true, name: true } } } },
          _count: { select: { tasks: true, projectServices: true, interactions: true } },
          projectServices: {
            include: { service: { select: { id: true, code: true, name: true, type: true, defaultPriceCents: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.task.findMany({
        where: { projectId: projectIdBigInt, businessId: businessIdBigInt },
        select: { status: true, progress: true },
      }),
    ]);

    if (!project) return notFound('Projet introuvable.');

    const summary = (() => {
      if (!taskRows.length) return { total: 0, open: 0, done: 0, progressPct: 0 };
      let total = 0;
      let done = 0;
      let open = 0;
      let sum = 0;
      for (const t of taskRows) {
        total += 1;
        const pct = t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0;
        sum += pct;
        if (t.status === 'DONE') done += 1;
        else open += 1;
      }
      return { total, done, open, progressPct: Math.round(sum / total) };
    })();

    const billingSummary = await computeProjectBillingSummary(businessIdBigInt, projectIdBigInt);

    return jsonb(
      {
        item: serializeProject(
          { ...project, tasksSummary: summary },
          { billingSummary, valueCents: billingSummary?.totalCents ?? null }
        ),
      },
      requestId
    );
  }
);

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}
export const PATCH = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:projects:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectId = params?.projectId;
    if (!projectId || !/^\d+$/.test(projectId)) return badRequest('projectId invalide.');
    const projectIdBigInt = BigInt(projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      include: {
        client: { select: { id: true, name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    });
    if (!project) return notFound('Projet introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const data: Record<string, unknown> = {};
    const depositPaidAtRaw = (body as { depositPaidAt?: unknown }).depositPaidAt;
    const wantsDepositPaidAt = depositPaidAtRaw !== undefined;
    const billingQuoteIdRaw = (body as { billingQuoteId?: unknown }).billingQuoteId;
    const wantsBillingQuoteId = billingQuoteIdRaw !== undefined;

    if ('startedAt' in body || 'archivedAt' in body) {
      return badRequest('startedAt/archivedAt ne peuvent pas être modifiés ici.');
    }

    if ('name' in body) {
      if (typeof (body as { name?: unknown }).name !== 'string') return badRequest('Nom invalide.');
      const trimmed = (body as { name: string }).name.trim();
      if (!trimmed) return badRequest('Le nom ne peut pas être vide.');
      data.name = trimmed;
    }

    if ('status' in body) {
      if (!isValidStatus((body as { status?: unknown }).status)) {
        return badRequest('Statut invalide.');
      }
      data.status = (body as { status: ProjectStatus }).status;
    }

    if ('quoteStatus' in body) {
      const quoteStatus = (body as { quoteStatus?: unknown }).quoteStatus;
      if (
        typeof quoteStatus !== 'string' ||
        !Object.values(ProjectQuoteStatus).includes(quoteStatus as ProjectQuoteStatus)
      ) {
        return badRequest('quoteStatus invalide.');
      }
      data.quoteStatus = quoteStatus as ProjectQuoteStatus;
    }

    if ('depositStatus' in body) {
      const depositStatus = (body as { depositStatus?: unknown }).depositStatus;
      if (
        typeof depositStatus !== 'string' ||
        !Object.values(ProjectDepositStatus).includes(depositStatus as ProjectDepositStatus)
      ) {
        return badRequest('depositStatus invalide.');
      }
      data.depositStatus = depositStatus as ProjectDepositStatus;
    }

    if (wantsDepositPaidAt) {
      if (depositPaidAtRaw === null) {
        data.depositPaidAt = null;
      } else {
        const depositPaidAt = parseIsoDate(depositPaidAtRaw);
        if (!depositPaidAt) {
          return badRequest('depositPaidAt invalide.');
        }
        data.depositPaidAt = depositPaidAt;
      }
    }

    if (wantsBillingQuoteId) {
      if (billingQuoteIdRaw === null || billingQuoteIdRaw === '') {
        data.billingQuoteId = null;
      } else if (typeof billingQuoteIdRaw === 'string' && /^\d+$/.test(billingQuoteIdRaw)) {
        const quoteIdBigInt = BigInt(billingQuoteIdRaw);
        const quote = await prisma.quote.findFirst({
          where: {
            id: quoteIdBigInt,
            businessId: businessIdBigInt,
            projectId: projectIdBigInt,
            status: 'SIGNED',
          },
          select: { id: true },
        });
        if (!quote) {
          return badRequest('billingQuoteId doit référencer un devis signé du projet.');
        }
        data.billingQuoteId = quoteIdBigInt;
        data.quoteStatus = ProjectQuoteStatus.SIGNED;
      } else {
        return badRequest('billingQuoteId invalide.');
      }
    }

    if ('clientId' in body) {
      const clientIdRaw = (body as { clientId?: unknown }).clientId;
      if (clientIdRaw === null || clientIdRaw === undefined || clientIdRaw === '') {
        data.clientId = null;
      } else if (typeof clientIdRaw === 'string' && /^\d+$/.test(clientIdRaw)) {
        const clientIdBigInt = BigInt(clientIdRaw);
        const client = await prisma.client.findFirst({
          where: { id: clientIdBigInt, businessId: businessIdBigInt },
          select: { id: true },
        });
        if (!client) return badRequest('clientId invalide pour ce business.');
        data.clientId = clientIdBigInt;
      } else {
        return badRequest('clientId invalide.');
      }
    }

    if ('startDate' in body) {
      const startDateRaw = (body as { startDate?: unknown }).startDate;
      if (startDateRaw === null || startDateRaw === undefined || startDateRaw === '') {
        data.startDate = null;
      } else if (typeof startDateRaw === 'string') {
        const start = new Date(startDateRaw);
        if (Number.isNaN(start.getTime())) return badRequest('startDate invalide.');
        data.startDate = start;
      } else {
        return badRequest('startDate invalide.');
      }
    }

    if ('endDate' in body) {
      const endDateRaw = (body as { endDate?: unknown }).endDate;
      if (endDateRaw === null || endDateRaw === undefined || endDateRaw === '') {
        data.endDate = null;
      } else if (typeof endDateRaw === 'string') {
        const end = new Date(endDateRaw);
        if (Number.isNaN(end.getTime())) return badRequest('endDate invalide.');
        data.endDate = end;
      } else {
        return badRequest('endDate invalide.');
      }
    }

    const nextDepositStatus =
      (data.depositStatus as ProjectDepositStatus | undefined) ?? project.depositStatus;
    if (wantsDepositPaidAt && depositPaidAtRaw !== null && nextDepositStatus !== ProjectDepositStatus.PAID) {
      return badRequest('depositPaidAt requiert depositStatus=PAID.');
    }
    if (!wantsDepositPaidAt && data.depositStatus !== undefined && data.depositStatus !== project.depositStatus) {
      if (nextDepositStatus === ProjectDepositStatus.PAID && !project.depositPaidAt) {
        data.depositPaidAt = new Date();
      }
      if (nextDepositStatus !== ProjectDepositStatus.PAID && project.depositPaidAt) {
        data.depositPaidAt = null;
      }
    }

    if ('prestationsText' in body) {
      const prestationsTextRaw = (body as { prestationsText?: unknown }).prestationsText;
      if (prestationsTextRaw === null || prestationsTextRaw === undefined || prestationsTextRaw === '') {
        data.prestationsText = null;
      } else if (typeof prestationsTextRaw === 'string') {
        const text = prestationsTextRaw.trim();
        if (text.length > 20000) {
          return badRequest('prestationsText trop long (20000 max).');
        }
        data.prestationsText = text || null;
      } else {
        return badRequest('prestationsText invalide.');
      }
    }

    const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'categoryReferenceId');
    const categoryReferenceId =
      categoryProvided &&
      typeof (body as { categoryReferenceId?: unknown }).categoryReferenceId === 'string' &&
      /^\d+$/.test((body as { categoryReferenceId: string }).categoryReferenceId)
        ? BigInt((body as { categoryReferenceId: string }).categoryReferenceId)
        : categoryProvided
          ? null
          : undefined;

    const tagProvided = Object.prototype.hasOwnProperty.call(body, 'tagReferenceIds');
    const tagReferenceIds: bigint[] | undefined = tagProvided
      ? Array.from(
          new Set(
            ((Array.isArray((body as { tagReferenceIds?: unknown }).tagReferenceIds)
              ? (body as { tagReferenceIds: unknown[] }).tagReferenceIds
              : []) as unknown[])
              .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
              .map((id) => BigInt(id))
          )
        )
      : undefined;

    let tagsInstruction: { deleteMany: { projectId: bigint }; create: Array<{ referenceId: bigint }> } | undefined;

    if (categoryProvided || tagProvided) {
      const validated = await validateCategoryAndTags(
        businessIdBigInt,
        categoryProvided ? categoryReferenceId ?? null : project.categoryReferenceId ?? null,
        tagProvided ? tagReferenceIds : project.tags.map((t) => t.referenceId)
      );
      if ('error' in validated) {
        return badRequest(validated.error);
      }
      if (categoryProvided) {
        data.categoryReferenceId = validated.categoryId;
      }
      if (tagProvided) {
        tagsInstruction = {
          deleteMany: { projectId: projectIdBigInt },
          create: validated.tagIds.map((id) => ({ referenceId: id })),
        };
      }
    }

    if (!tagsInstruction && Object.keys(data).length === 0) {
      return badRequest('Aucune modification.');
    }

    const updated = await prisma.project.update({
      where: { id: projectIdBigInt },
      data: {
        ...data,
        ...(tagsInstruction ? { tags: tagsInstruction } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
        _count: { select: { tasks: true, projectServices: true, interactions: true } },
      },
    });

    const billingSummary = await computeProjectBillingSummary(businessIdBigInt, projectIdBigInt);

    return jsonb({ item: serializeProject(updated, { billingSummary }) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:projects:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
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

    await prisma.project.delete({ where: { id: projectIdBigInt } });

    return jsonbNoContent(requestId);
  }
);
