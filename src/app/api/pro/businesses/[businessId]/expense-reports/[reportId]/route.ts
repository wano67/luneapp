import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, forbidden, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const include = {
  user: { select: { name: true, email: true } },
  project: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} as const;

function serialize(r: {
  id: bigint; userId: bigint; projectId: bigint | null; title: string;
  amountCents: number; category: string | null; description: string | null;
  receiptUrl: string | null; expenseDate: Date; status: string;
  reviewedByUserId: bigint | null; reviewedAt: Date | null; createdAt: Date;
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

// PATCH /api/pro/businesses/{businessId}/expense-reports/{reportId}
export const PATCH = withBusinessRoute<{ businessId: string; reportId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:expense:update:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const reportId = parseIdOpt(params?.reportId);
    if (!reportId) return badRequest('reportId invalide.');

    const existing = await prisma.expenseReport.findFirst({
      where: { id: reportId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Note de frais introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const isAdmin = ctx.membership.role === 'OWNER' || ctx.membership.role === 'ADMIN';

    // Status changes — admin only (approve/reject/reimburse)
    if ('status' in b) {
      if (!isAdmin) return forbidden('Seuls les admins peuvent changer le statut.');
      const validStatuses = ['APPROVED', 'REJECTED', 'REIMBURSED'];
      if (!validStatuses.includes(b.status as string)) return badRequest('status invalide.');

      const updated = await prisma.expenseReport.update({
        where: { id: reportId },
        data: {
          status: b.status as 'APPROVED' | 'REJECTED' | 'REIMBURSED',
          reviewedByUserId: ctx.userId,
          reviewedAt: new Date(),
        },
        include,
      });
      return jsonb({ item: serialize(updated) }, ctx.requestId);
    }

    // Submit — owner only, from DRAFT
    if ('submit' in b && b.submit === true) {
      if (existing.userId !== ctx.userId) return forbidden('Seul le créateur peut soumettre.');
      if (existing.status !== 'DRAFT') return badRequest('Seules les notes brouillon peuvent être soumises.');
      const updated = await prisma.expenseReport.update({
        where: { id: reportId },
        data: { status: 'SUBMITTED' },
        include,
      });
      return jsonb({ item: serialize(updated) }, ctx.requestId);
    }

    // Edit fields — owner only, DRAFT status
    if (existing.userId !== ctx.userId && !isAdmin) {
      return forbidden('Vous ne pouvez modifier que vos propres notes.');
    }
    if (existing.status !== 'DRAFT' && !isAdmin) {
      return badRequest('Seules les notes brouillon peuvent être modifiées.');
    }

    const data: Record<string, unknown> = {};
    if ('title' in b && typeof b.title === 'string') {
      data.title = b.title.trim().slice(0, 200);
    }
    if ('amountCents' in b && typeof b.amountCents === 'number') {
      data.amountCents = Math.trunc(b.amountCents);
    }
    if ('category' in b) {
      data.category = typeof b.category === 'string' ? b.category.trim().slice(0, 100) || null : null;
    }
    if ('description' in b) {
      data.description = typeof b.description === 'string' ? b.description.trim().slice(0, 1000) || null : null;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.expenseReport.update({
      where: { id: reportId },
      data,
      include,
    });

    return jsonb({ item: serialize(updated) }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/expense-reports/{reportId}
export const DELETE = withBusinessRoute<{ businessId: string; reportId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:expense:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const reportId = parseIdOpt(params?.reportId);
    if (!reportId) return badRequest('reportId invalide.');

    const existing = await prisma.expenseReport.findFirst({
      where: { id: reportId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Note de frais introuvable.');

    const isAdmin = ctx.membership.role === 'OWNER' || ctx.membership.role === 'ADMIN';
    if (existing.userId !== ctx.userId && !isAdmin) {
      return forbidden('Vous ne pouvez supprimer que vos propres notes.');
    }
    if (existing.status !== 'DRAFT' && !isAdmin) {
      return badRequest('Seules les notes brouillon peuvent être supprimées.');
    }

    await prisma.expenseReport.delete({ where: { id: reportId } });
    return jsonbNoContent(ctx.requestId);
  },
);
