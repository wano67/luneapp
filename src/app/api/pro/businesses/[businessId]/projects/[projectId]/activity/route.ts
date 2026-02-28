import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/projects/{projectId}/activity
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam && /^\d+$/.test(limitParam) ? Math.min(50, Math.max(1, Number(limitParam))) : 20;

    const rows = await prisma.task.findMany({
      where: { projectId, businessId: ctx.businessId, statusUpdatedAt: { not: null } },
      orderBy: { statusUpdatedAt: 'desc' },
      take: limit,
      include: {
        statusUpdatedByUser: { select: { id: true, name: true, email: true } },
        projectService: { select: { id: true, service: { select: { name: true } } } },
      },
    });

    return jsonb(
      {
        items: rows.map((task) => ({
          type: 'TASK_STATUS_UPDATED',
          taskId: task.id,
          title: task.title,
          status: task.status,
          serviceName: task.projectService?.service?.name ?? null,
          occurredAt: task.statusUpdatedAt,
          actor: task.statusUpdatedByUser
            ? {
                id: task.statusUpdatedByUser.id,
                name: task.statusUpdatedByUser.name ?? null,
                email: task.statusUpdatedByUser.email ?? null,
              }
            : null,
        })),
      },
      ctx.requestId
    );
  }
);
