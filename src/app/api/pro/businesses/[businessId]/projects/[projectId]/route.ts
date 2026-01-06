import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import {
  BusinessReferenceType,
  ProjectDepositStatus,
  ProjectQuoteStatus,
  ProjectStatus,
} from '@/generated/prisma';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
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

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function serializeProject(project: {
  id: bigint;
  businessId: bigint;
  clientId: bigint | null;
  name: string;
  status: ProjectStatus;
  quoteStatus: ProjectQuoteStatus;
  depositStatus: ProjectDepositStatus;
  startedAt: Date | null;
  archivedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
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
}) {
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
    startedAt: project.startedAt ? project.startedAt.toISOString() : null,
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    endDate: project.endDate ? project.endDate.toISOString() : null,
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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
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
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, projectId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

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

  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

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

  return withIdNoStore(jsonNoStore({ item: serializeProject({ ...project, tasksSummary: summary }) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:projects:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    include: {
      client: { select: { id: true, name: true } },
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('startedAt' in body || 'archivedAt' in body) {
    return withIdNoStore(badRequest('startedAt/archivedAt ne peuvent pas être modifiés ici.'), requestId);
  }

  if ('name' in body) {
    if (typeof body.name !== 'string') return withIdNoStore(badRequest('Nom invalide.'), requestId);
    const trimmed = body.name.trim();
    if (!trimmed) return withIdNoStore(badRequest('Le nom ne peut pas être vide.'), requestId);
    data.name = trimmed;
  }

  if ('status' in body) {
    if (!isValidStatus(body.status)) {
      return withIdNoStore(badRequest('Statut invalide.'), requestId);
    }
    data.status = body.status as ProjectStatus;
  }

  if ('quoteStatus' in body) {
    const quoteStatus = (body as { quoteStatus?: unknown }).quoteStatus;
    if (
      typeof quoteStatus !== 'string' ||
      !Object.values(ProjectQuoteStatus).includes(quoteStatus as ProjectQuoteStatus)
    ) {
      return withIdNoStore(badRequest('quoteStatus invalide.'), requestId);
    }
    data.quoteStatus = quoteStatus as ProjectQuoteStatus;
  }

  if ('depositStatus' in body) {
    const depositStatus = (body as { depositStatus?: unknown }).depositStatus;
    if (
      typeof depositStatus !== 'string' ||
      !Object.values(ProjectDepositStatus).includes(depositStatus as ProjectDepositStatus)
    ) {
      return withIdNoStore(badRequest('depositStatus invalide.'), requestId);
    }
    data.depositStatus = depositStatus as ProjectDepositStatus;
  }

  if ('clientId' in body) {
    if (body.clientId === null || body.clientId === undefined || body.clientId === '') {
      data.clientId = null;
    } else if (typeof body.clientId === 'string' && /^\d+$/.test(body.clientId)) {
      const clientIdBigInt = BigInt(body.clientId);
      const client = await prisma.client.findFirst({
        where: { id: clientIdBigInt, businessId: businessIdBigInt },
        select: { id: true },
      });
      if (!client) return withIdNoStore(badRequest('clientId invalide pour ce business.'), requestId);
      data.clientId = clientIdBigInt;
    } else {
      return withIdNoStore(badRequest('clientId invalide.'), requestId);
    }
  }

  if ('startDate' in body) {
    if (body.startDate === null || body.startDate === undefined || body.startDate === '') {
      data.startDate = null;
    } else if (typeof body.startDate === 'string') {
      const start = new Date(body.startDate);
      if (Number.isNaN(start.getTime())) return withIdNoStore(badRequest('startDate invalide.'), requestId);
      data.startDate = start;
    } else {
      return withIdNoStore(badRequest('startDate invalide.'), requestId);
    }
  }

  if ('endDate' in body) {
    if (body.endDate === null || body.endDate === undefined || body.endDate === '') {
      data.endDate = null;
    } else if (typeof body.endDate === 'string') {
      const end = new Date(body.endDate);
      if (Number.isNaN(end.getTime())) return withIdNoStore(badRequest('endDate invalide.'), requestId);
      data.endDate = end;
    } else {
      return withIdNoStore(badRequest('endDate invalide.'), requestId);
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

  let tagsInstruction: { deleteMany: { projectId: bigint }; create: Array<{ referenceId: bigint }> } | undefined;

  if (categoryProvided || tagProvided) {
    const validated = await validateCategoryAndTags(
      businessIdBigInt,
      categoryProvided ? categoryReferenceId ?? null : project.categoryReferenceId ?? null,
      tagProvided ? tagReferenceIds : project.tags.map((t) => t.referenceId)
    );
    if ('error' in validated) {
      return withIdNoStore(badRequest(validated.error), requestId);
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
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
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

  return withIdNoStore(jsonNoStore({ item: serializeProject(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:projects:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  await prisma.project.delete({ where: { id: projectIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
