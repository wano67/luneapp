import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, forbidden, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/leave-requests/{requestId}
export const PATCH = withBusinessRoute<{ businessId: string; requestId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:leave:update:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const requestId = parseIdOpt(params?.requestId);
    if (!requestId) return badRequest('requestId invalide.');

    const existing = await prisma.leaveRequest.findFirst({
      where: { id: requestId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Demande introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const isAdmin = ctx.membership.role === 'OWNER' || ctx.membership.role === 'ADMIN';
    const isOwner = existing.userId === ctx.userId;

    // Approve/reject — admin only
    if ('status' in b) {
      if (!isAdmin) return forbidden('Seuls les admins peuvent approuver/rejeter.');
      const newStatus = b.status as string;
      if (newStatus !== 'APPROVED' && newStatus !== 'REJECTED') return badRequest('status invalide (APPROVED/REJECTED).');

      const updated = await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          reviewedByUserId: ctx.userId,
          reviewedAt: new Date(),
        },
        include: {
          user: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
        },
      });

      return jsonb({
        item: {
          id: updated.id.toString(),
          userId: updated.userId.toString(),
          userName: updated.user.name ?? updated.user.email,
          type: updated.type,
          status: updated.status,
          startDate: updated.startDate.toISOString(),
          endDate: updated.endDate.toISOString(),
          days: updated.days,
          reason: updated.reason,
          reviewedByName: updated.reviewedBy?.name ?? null,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
        },
      }, ctx.requestId);
    }

    // Cancel own pending request
    if (!isOwner && !isAdmin) return forbidden('Vous ne pouvez modifier que vos propres demandes.');
    if (existing.status !== 'PENDING') return badRequest('Seules les demandes en attente peuvent être modifiées.');

    const data: Record<string, unknown> = {};
    if ('reason' in b && typeof b.reason === 'string') {
      data.reason = b.reason.trim().slice(0, 500) || null;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data,
      include: {
        user: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        userId: updated.userId.toString(),
        userName: updated.user.name ?? updated.user.email,
        type: updated.type,
        status: updated.status,
        startDate: updated.startDate.toISOString(),
        endDate: updated.endDate.toISOString(),
        days: updated.days,
        reason: updated.reason,
        reviewedByName: updated.reviewedBy?.name ?? null,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/leave-requests/{requestId}
export const DELETE = withBusinessRoute<{ businessId: string; requestId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:leave:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const requestId = parseIdOpt(params?.requestId);
    if (!requestId) return badRequest('requestId invalide.');

    const existing = await prisma.leaveRequest.findFirst({
      where: { id: requestId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Demande introuvable.');

    const isAdmin = ctx.membership.role === 'OWNER' || ctx.membership.role === 'ADMIN';
    if (existing.userId !== ctx.userId && !isAdmin) {
      return forbidden('Vous ne pouvez supprimer que vos propres demandes.');
    }
    if (existing.status !== 'PENDING' && !isAdmin) {
      return badRequest('Seules les demandes en attente peuvent être supprimées.');
    }

    await prisma.leaveRequest.delete({ where: { id: requestId } });
    return jsonbNoContent(ctx.requestId);
  },
);
