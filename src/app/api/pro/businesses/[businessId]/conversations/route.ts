import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseStr, parseEnum, parseIdArray } from '@/server/http/parsers';
import type { ConversationType } from '@/generated/prisma';

// GET /api/pro/businesses/:businessId/conversations
// Lists business-level conversations (projectId IS NULL)
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId: ctx.businessId,
        projectId: null,
        members: { some: { userId: ctx.userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, createdAt: true, senderUserId: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const items = conversations.map((c) => {
      const myMembership = c.members.find((m) => m.userId === ctx.userId);
      const lastMsg = c.messages[0] ?? null;
      const unreadCount = myMembership?.lastReadAt && lastMsg
        ? (lastMsg.createdAt > myMembership.lastReadAt ? 1 : 0)
        : (lastMsg ? 1 : 0);

      return {
        id: c.id,
        type: c.type,
        name: c.name,
        memberCount: c.members.length,
        members: c.members.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
        })),
        lastMessage: lastMsg
          ? { id: lastMsg.id, content: lastMsg.content, createdAt: lastMsg.createdAt, senderUserId: lastMsg.senderUserId }
          : null,
        totalMessages: c._count.messages,
        unreadCount,
        updatedAt: c.updatedAt,
      };
    });

    return jsonb({ items }, ctx.requestId);
  }
);

// POST /api/pro/businesses/:businessId/conversations
export const POST = withBusinessRoute(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:biz-conversations:create:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest('Body JSON requis.');

    const type = parseEnum<ConversationType>(body.type, ['PRIVATE', 'GROUP'], 'type');
    const name = parseStr(body.name, 100);
    const memberUserIds = parseIdArray(body.memberUserIds ?? []);

    if (type === 'GROUP' && !name) {
      return badRequest('Un nom est requis pour les conversations de groupe.');
    }

    const allMemberIds = new Set([ctx.userId, ...memberUserIds]);

    if (type === 'PRIVATE') {
      if (allMemberIds.size !== 2) {
        return badRequest('Une conversation privée nécessite exactement 2 membres.');
      }

      const otherUserId = [...allMemberIds].find((id) => id !== ctx.userId)!;
      const existing = await prisma.conversation.findFirst({
        where: {
          businessId: ctx.businessId,
          projectId: null,
          type: 'PRIVATE',
          AND: [
            { members: { some: { userId: ctx.userId } } },
            { members: { some: { userId: otherUserId } } },
          ],
        },
        select: { id: true },
      });
      if (existing) {
        return jsonb({ item: { id: existing.id, alreadyExists: true } }, ctx.requestId);
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        businessId: ctx.businessId,
        projectId: null,
        type,
        name: type === 'GROUP' ? name : null,
        createdByUserId: ctx.userId,
        members: {
          create: [...allMemberIds].map((userId) => ({ userId })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return jsonbCreated({
      item: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        members: conversation.members.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
        })),
      },
    }, ctx.requestId);
  }
);
