import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

const MAX_PER_CATEGORY = 5;

// GET /api/pro/businesses/{businessId}/search?q=...
export const GET = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'VIEWER',
    rateLimit: {
      key: (ctx) => `pro:search:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 1000,
    },
  },
  async (ctx, req) => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return badRequest('Requête trop courte (min 2 caractères).');

    const bId = ctx.businessId;
    const search = { contains: q, mode: 'insensitive' as const };

    // Run all searches in parallel
    const [projects, clients, prospects, tasks, messages, documents] = await Promise.all([
      // Projects
      prisma.project.findMany({
        where: { businessId: bId, name: search },
        select: { id: true, name: true, status: true },
        take: MAX_PER_CATEGORY,
        orderBy: { updatedAt: 'desc' },
      }),
      // Clients
      prisma.client.findMany({
        where: { businessId: bId, OR: [{ name: search }, { companyName: search }] },
        select: { id: true, name: true, companyName: true },
        take: MAX_PER_CATEGORY,
        orderBy: { updatedAt: 'desc' },
      }),
      // Prospects
      prisma.prospect.findMany({
        where: { businessId: bId, OR: [{ name: search }, { contactName: search }] },
        select: { id: true, name: true, contactName: true },
        take: MAX_PER_CATEGORY,
        orderBy: { updatedAt: 'desc' },
      }),
      // Tasks
      prisma.task.findMany({
        where: { businessId: bId, title: search },
        select: {
          id: true,
          title: true,
          status: true,
          projectId: true,
          project: { select: { name: true } },
        },
        take: MAX_PER_CATEGORY,
        orderBy: { updatedAt: 'desc' },
      }),
      // Messages (search content in conversations the user is a member of)
      prisma.message.findMany({
        where: {
          content: search,
          conversation: {
            businessId: bId,
            members: { some: { userId: ctx.userId } },
          },
        },
        select: {
          id: true,
          content: true,
          conversationId: true,
          createdAt: true,
          sender: { select: { name: true, email: true } },
          conversation: { select: { name: true, projectId: true } },
        },
        take: MAX_PER_CATEGORY,
        orderBy: { createdAt: 'desc' },
      }),
      // Documents
      prisma.businessDocument.findMany({
        where: {
          businessId: bId,
          OR: [{ title: search }, { filename: search }],
        },
        select: {
          id: true,
          title: true,
          filename: true,
          projectId: true,
          project: { select: { name: true } },
        },
        take: MAX_PER_CATEGORY,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return jsonb({
      projects: projects.map((p) => ({
        id: p.id.toString(),
        name: p.name,
        status: p.status,
        type: 'project' as const,
      })),
      clients: clients.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        company: c.companyName,
        type: 'client' as const,
      })),
      prospects: prospects.map((p) => ({
        id: p.id.toString(),
        name: p.name,
        contactName: p.contactName,
        type: 'prospect' as const,
      })),
      tasks: tasks.map((t) => ({
        id: t.id.toString(),
        title: t.title,
        status: t.status,
        projectId: t.projectId?.toString() ?? null,
        projectName: t.project?.name ?? null,
        type: 'task' as const,
      })),
      messages: messages.map((m) => ({
        id: m.id.toString(),
        content: m.content?.slice(0, 100) ?? '',
        conversationId: m.conversationId.toString(),
        conversationName: m.conversation.name,
        projectId: m.conversation.projectId?.toString() ?? null,
        senderName: m.sender.name ?? m.sender.email,
        createdAt: m.createdAt.toISOString(),
        type: 'message' as const,
      })),
      documents: documents.map((d) => ({
        id: d.id.toString(),
        title: d.title,
        filename: d.filename,
        projectId: d.projectId?.toString() ?? null,
        projectName: d.project?.name ?? null,
        type: 'document' as const,
      })),
    }, ctx.requestId);
  }
);
