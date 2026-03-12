import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId, parseStr, parseIdOpt } from '@/server/http/parsers';
import { notifyMessageReceived } from '@/server/services/notifications';
import { saveLocalFile } from '@/server/storage/local';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function serializeMessage(m: {
  id: bigint;
  conversationId: bigint;
  senderUserId: bigint;
  parentMessageId: bigint | null;
  replyCount: number;
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
    parentMessageId: m.parentMessageId,
    replyCount: m.replyCount,
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
    const threadOfStr = url.searchParams.get('threadOf');
    const threadOf = threadOfStr ? parseId(threadOfStr) : undefined;

    const where: Record<string, unknown> = { conversationId };
    if (threadOf) {
      where.parentMessageId = threadOf;
    } else {
      where.parentMessageId = null;
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: threadOf ? ('asc' as const) : ('desc' as const) },
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

    let content: string | null = null;
    let taskId: bigint | null = null;
    let taskGroupIds: string | null = null;
    let parentMessageId: bigint | null = null;
    let files: File[] = [];

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();

      content = parseStr(form.get('content') as string | null, 5000);
      taskId = parseIdOpt(form.get('taskId') as string | null);
      parentMessageId = parseIdOpt(form.get('parentMessageId') as string | null);
      const taskGroupIdsRaw = form.get('taskGroupIds') as string | null;
      taskGroupIds = taskGroupIdsRaw ? taskGroupIdsRaw.split(',').map((s) => s.trim()).filter(Boolean).join(',') : null;

      files = form.getAll('files').filter((f): f is File => f instanceof File);

      // Validate files
      if (files.length > MAX_FILES) {
        return badRequest(`Maximum ${MAX_FILES} fichiers autorisés.`);
      }
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          return badRequest(`Le fichier "${file.name}" dépasse la taille maximale de 10 Mo.`);
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          return badRequest(`Type de fichier non autorisé : ${file.type}`);
        }
      }

      if (!content && !taskId && !taskGroupIds && files.length === 0) {
        return badRequest('Le message doit contenir du texte, une référence de tâche ou des fichiers.');
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest('Body JSON requis.');

      content = parseStr(body.content, 5000);
      taskId = parseIdOpt(body.taskId);
      parentMessageId = parseIdOpt((body as Record<string, unknown>).parentMessageId as string | null);
      taskGroupIds = Array.isArray(body.taskGroupIds)
        ? body.taskGroupIds.map(String).join(',')
        : null;

      if (!content && !taskId && !taskGroupIds) {
        return badRequest('Le message doit contenir du texte ou une référence de tâche.');
      }
    }

    // Validate parent message belongs to this conversation
    if (parentMessageId) {
      const parent = await prisma.message.findFirst({
        where: { id: parentMessageId, conversationId },
        select: { id: true },
      });
      if (!parent) return badRequest('Message parent introuvable.');
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderUserId: ctx.userId,
        content,
        taskId,
        taskGroupIds: taskGroupIds || null,
        parentMessageId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        attachments: true,
      },
    });

    // Increment parent replyCount
    if (parentMessageId) {
      await prisma.message.update({
        where: { id: parentMessageId },
        data: { replyCount: { increment: 1 } },
      });
    }

    // Save file attachments
    if (files.length > 0) {
      const projectId = parseIdOpt(params.projectId);
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { storageKey, filename: savedFilename } = await saveLocalFile({
          buffer,
          filename: file.name,
          businessId: ctx.businessId,
          projectId,
        });
        await prisma.messageAttachment.create({
          data: {
            messageId: message.id,
            filename: savedFilename,
            mimeType: file.type,
            sizeBytes: file.size,
            storageKey,
          },
        });
      }
    }

    // Re-fetch message with attachments if files were uploaded
    const finalMessage = files.length > 0
      ? await prisma.message.findUniqueOrThrow({
          where: { id: message.id },
          include: {
            sender: { select: { id: true, name: true, email: true } },
            attachments: true,
          },
        })
      : message;

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

    // Fire-and-forget: notify other conversation members
    const projectId = parseIdOpt(params.projectId);
    void notifyMessageReceived(
      conversationId,
      ctx.userId,
      ctx.businessId,
      message.sender.name || message.sender.email,
      content,
      projectId,
    );

    return jsonbCreated({ item: serializeMessage(finalMessage) }, ctx.requestId);
  }
);
