import { prisma } from '@/server/db/client';
import { ExpenseStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function serialize(r: {
  id: bigint; userId: bigint; projectId: bigint | null; title: string;
  amountCents: number; category: string | null; description: string | null;
  receiptUrl: string | null; expenseDate: Date; status: string;
  reviewedByUserId: bigint | null; reviewedAt: Date | null;
  createdAt: Date;
  user: { name: string | null; email: string };
  project: { name: string } | null;
  reviewedBy: { name: string | null } | null;
}) {
  return {
    id: r.id.toString(),
    userId: r.userId.toString(),
    userName: r.user.name ?? r.user.email,
    projectId: r.projectId?.toString() ?? null,
    projectName: r.project?.name ?? null,
    title: r.title,
    amountCents: r.amountCents,
    category: r.category,
    description: r.description,
    receiptUrl: r.receiptUrl,
    expenseDate: r.expenseDate.toISOString(),
    status: r.status,
    reviewedByName: r.reviewedBy?.name ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

const include = {
  user: { select: { name: true, email: true } },
  project: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} as const;

// GET /api/pro/businesses/{businessId}/expense-reports
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');

    const where: Record<string, unknown> = { businessId: ctx.businessId };
    if (statusFilter && Object.values(ExpenseStatus).includes(statusFilter as ExpenseStatus)) {
      where.status = statusFilter;
    }
    if (ctx.membership.role === 'MEMBER' || ctx.membership.role === 'VIEWER') {
      where.userId = ctx.userId;
    }

    const items = await prisma.expenseReport.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/expense-reports
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:expense:create:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { title, amountCents, category, description, expenseDate, projectId } = body as Record<string, unknown>;

    if (typeof title !== 'string' || !title.trim()) return badRequest('title requis.');
    if (title.trim().length > 200) return badRequest('title trop long.');
    if (typeof amountCents !== 'number' || !Number.isFinite(amountCents) || amountCents <= 0) {
      return badRequest('amountCents requis (> 0).');
    }
    if (typeof expenseDate !== 'string') return badRequest('expenseDate requis.');
    const date = new Date(expenseDate);
    if (isNaN(date.getTime())) return badRequest('expenseDate invalide.');

    let projectIdBigInt: bigint | null = null;
    if (projectId) {
      projectIdBigInt = parseIdOpt(projectId as string);
      if (projectIdBigInt) {
        const project = await prisma.project.findFirst({
          where: { id: projectIdBigInt, businessId: ctx.businessId },
          select: { id: true },
        });
        if (!project) return badRequest('Projet introuvable.');
      }
    }

    const item = await prisma.expenseReport.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.userId,
        projectId: projectIdBigInt,
        title: title.trim(),
        amountCents: Math.trunc(amountCents),
        category: typeof category === 'string' ? category.trim().slice(0, 100) || null : null,
        description: typeof description === 'string' ? description.trim().slice(0, 1000) || null : null,
        expenseDate: date,
      },
      include,
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
