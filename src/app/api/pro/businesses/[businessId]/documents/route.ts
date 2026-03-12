import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { prisma } from '@/server/db/client';

// GET /api/pro/businesses/{businessId}/documents
// Returns all business documents grouped by source
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const [documents, projectSummaries, clientSummaries] = await Promise.all([
    prisma.businessDocument.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        title: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        kind: true,
        createdAt: true,
        projectId: true,
        clientId: true,
        taskId: true,
        folderId: true,
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),

    // Projects with document counts
    prisma.businessDocument.groupBy({
      by: ['projectId'],
      where: { businessId: ctx.businessId, projectId: { not: null } },
      _count: { _all: true },
    }),

    // Clients with document counts
    prisma.businessDocument.groupBy({
      by: ['clientId'],
      where: { businessId: ctx.businessId, clientId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  // Enrich project summaries with names
  const projectIds = projectSummaries
    .map((s) => s.projectId)
    .filter((id): id is bigint => id !== null);
  const projects = projectIds.length > 0
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
    : [];
  const projectMap = new Map(projects.map((p) => [p.id.toString(), p.name]));

  // Enrich client summaries with names
  const clientIds = clientSummaries
    .map((s) => s.clientId)
    .filter((id): id is bigint => id !== null);
  const clients = clientIds.length > 0
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientMap = new Map(clients.map((c) => [c.id.toString(), c.name]));

  return jsonb({
    items: documents.map((d) => ({
      id: d.id.toString(),
      title: d.title,
      filename: d.filename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      kind: d.kind,
      createdAt: d.createdAt,
      projectId: d.projectId?.toString() ?? null,
      projectName: d.project?.name ?? null,
      clientId: d.clientId?.toString() ?? null,
      clientName: d.client?.name ?? null,
      taskId: d.taskId?.toString() ?? null,
      taskTitle: d.task?.title ?? null,
      folderId: d.folderId?.toString() ?? null,
    })),
    projectSummaries: projectSummaries.map((s) => ({
      projectId: s.projectId!.toString(),
      projectName: projectMap.get(s.projectId!.toString()) ?? 'Projet',
      count: s._count._all,
    })),
    clientSummaries: clientSummaries.map((s) => ({
      clientId: s.clientId!.toString(),
      clientName: clientMap.get(s.clientId!.toString()) ?? 'Client',
      count: s._count._all,
    })),
    total: documents.length,
  }, ctx.requestId);
});
