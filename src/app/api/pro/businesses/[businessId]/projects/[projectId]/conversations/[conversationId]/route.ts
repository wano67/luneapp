import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { notFound, forbidden } from '@/server/http/apiUtils';
import { parseId, parseStr } from '@/server/http/parsers';

// GET /api/pro/businesses/:businessId/projects/:projectId/conversations/:conversationId
export const GET = withBusinessRoute<{ businessId: string; projectId: string; conversationId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const conversationId = parseId(params.conversationId);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId: ctx.businessId,
        members: { some: { userId: ctx.userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!conversation) return notFound('Conversation introuvable.');

    return jsonb({
      item: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        projectId: conversation.projectId,
        createdByUserId: conversation.createdByUserId,
        createdAt: conversation.createdAt,
        members: conversation.members.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          joinedAt: m.joinedAt,
        })),
      },
    }, ctx.requestId);
  }
);

// PATCH /api/pro/businesses/:businessId/projects/:projectId/conversations/:conversationId
export const PATCH = withBusinessRoute<{ businessId: string; projectId: string; conversationId: string }>(
  { minRole: 'MEMBER' },
  async (ctx, req, params) => {
    const conversationId = parseId(params.conversationId);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId: ctx.businessId,
        members: { some: { userId: ctx.userId } },
      },
    });
    if (!conversation) return notFound('Conversation introuvable.');

    if (conversation.type === 'PRIVATE') {
      return forbidden();
    }

    const body = await req.json().catch(() => null);
    if (!body) return jsonb({ item: { id: conversation.id } }, ctx.requestId);

    const name = parseStr(body.name, 100);
    if (name) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { name },
      });
    }

    return jsonb({ item: { id: conversationId, name: name ?? conversation.name } }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/:businessId/projects/:projectId/conversations/:conversationId
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string; conversationId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:conversations:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const conversationId = parseId(params.conversationId);

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, businessId: ctx.businessId },
    });
    if (!conversation) return notFound('Conversation introuvable.');

    await prisma.conversation.delete({ where: { id: conversationId } });

    return jsonbNoContent(ctx.requestId);
  }
);
