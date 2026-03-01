import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId, parseStr, parseIdOpt } from '@/server/http/parsers';

function serializeMessage(m: {
  id: bigint;
  conversationId: bigint;
  senderUserId: bigint;
  content: string | null;
  taskId: bigint | null;
  taskGroupIds: string | null;
  createdAt: Date;
  editedAt: Date | null;
  sender: { id: bigint; name: string | null; email: string };
  attachments: Array<{
    id: bigint;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderUserId: m.senderUserId,
    senderName: m.sender.name || m.sender.email,
    content: m.content,
    taskId: m.taskId,
    taskGroupIds: m.taskGroupIds ? m.taskGroupIds.split(',') : [],
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt,
    })),
  };
}

// GET /api/pro/businesses/:businessId/projects/:projectId/conversations/:conversationId/messages
export const GET = withBusinessRoute<{ businessId: string; projectId: string; conversationId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req, params) => {
    const conversationId = parseId(params.conversationId);

    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: ctx.userId } },
    });
    if (!member) return notFound('Conversation introuvable.');

    const url = new URL(req.url);
    const cursorStr = url.searchParams.get('cursor');
    const cursor = cursorStr ? parseId(cursorStr) : undefined;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, name: true, email: true } },
        attachments: true,
      },
    });

    const hasMore = messages.length > limit;
    const items = (hasMore ? messages.slice(0, limit) : messages).map(serializeMessage);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Update lastReadAt
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: ctx.userId } },
      data: { lastReadAt: new Date() },
    });

    return jsonb({ items, nextCursor, hasMore }, ctx.requestId);
  }
);

// POST /api/pro/businesses/:businessId/projects/:projectId/conversations/:conversationId/messages
export const POST = withBusinessRoute<{ businessId: string; projectId: string; conversationId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:messages:send:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const conversationId = parseId(params.conversationId);

    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: ctx.userId } },
    });
    if (!member) return notFound('Conversation introuvable.');

    const body = await req.json().catch(() => null);
    if (!body) return badRequest('Body JSON requis.');

    const content = parseStr(body.content, 5000);
    const taskId = parseIdOpt(body.taskId);
    const taskGroupIds = Array.isArray(body.taskGroupIds)
      ? body.taskGroupIds.map(String).join(',')
      : null;

    if (!content && !taskId && !taskGroupIds) {
      return badRequest('Le message doit contenir du texte ou une référence de tâche.');
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderUserId: ctx.userId,
        content,
        taskId,
        taskGroupIds: taskGroupIds || null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        attachments: true,
      },
    });

    // Touch conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Update sender lastReadAt
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: ctx.userId } },
      data: { lastReadAt: new Date() },
    });

    return jsonbCreated({ item: serializeMessage(message) }, ctx.requestId);
  }
);
