import { prisma } from '@/server/db/client';
import {
  ProjectDepositStatus,
  ProjectQuoteStatus,
  ProjectStatus,
} from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';
import { computeProjectBillingSummary } from '@/server/billing/summary';

/** Reshape a Prisma project into the API response shape. deepSerialize (via jsonb) handles BigInt/Date. */
function reshapeProject(
  project: Record<string, unknown> & {
    client?: { id: bigint; name: string | null } | null;
    categoryReference?: { id: bigint; name: string | null } | null;
    tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
    _count?: { tasks: number; projectServices: number; interactions: number };
    tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  },
  opts?: { billingSummary?: unknown; valueCents?: bigint | null }
) {
  return {
    ...project,
    clientName: project.client?.name ?? null,
    categoryReferenceName: project.categoryReference?.name ?? null,
    tagReferences: project.tags
      ? project.tags.map((tag) => ({ id: tag.reference.id, name: tag.reference.name }))
      : [],
    counts: project._count,
    billingSummary: opts?.billingSummary ?? null,
    valueCents: opts?.valueCents ?? null,
    tasksSummary: project.tasksSummary,
  };
}

function isValidStatus(status: unknown): status is ProjectStatus {
  return typeof status === 'string' && Object.values(ProjectStatus).includes(status as ProjectStatus);
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const projectIdBigInt = parseIdOpt(params?.projectId);
    if (!projectIdBigInt) return badRequest('projectId invalide.');

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
        item: reshapeProject(
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
    const projectIdBigInt = parseIdOpt(params?.projectId);
    if (!projectIdBigInt) return badRequest('projectId invalide.');

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
        const depositPaidAt = parseDateOpt(depositPaidAtRaw);
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

    return jsonb({ item: reshapeProject(updated, { billingSummary }) }, requestId);
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
    const projectIdBigInt = parseIdOpt(params?.projectId);
    if (!projectIdBigInt) return badRequest('projectId invalide.');

    const project = await prisma.project.findFirst({
      where: { id: projectIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    await prisma.project.delete({ where: { id: projectIdBigInt } });

    return jsonbNoContent(requestId);
  }
);
