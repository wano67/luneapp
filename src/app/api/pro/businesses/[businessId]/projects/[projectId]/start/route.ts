import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import type { TaskPhase } from '@/generated/prisma';

// POST /api/pro/businesses/{businessId}/projects/{projectId}/start
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:projects:start:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      include: {
        projectServices: { include: { service: { include: { taskTemplates: true } } } },
      },
    });
    if (!project) return notFound('Projet introuvable.');

    if (project.archivedAt) {
      return badRequest('Projet archivé : démarrage impossible.');
    }

    if (project.startedAt) {
      return jsonb(
        { startedAt: project.startedAt, tasksCreated: 0 },
        ctx.requestId
      );
    }

    if (!(project.quoteStatus === 'SIGNED' || project.quoteStatus === 'ACCEPTED')) {
      return badRequest('Le devis doit être signé/accepté avant démarrage.');
    }
    if (!(project.depositStatus === 'PAID' || project.depositStatus === 'NOT_REQUIRED')) {
      return badRequest('L\u2019acompte doit être payé ou non requis.');
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const existingTasks = await tx.task.findMany({
        where: { projectId, businessId: ctx.businessId },
        select: { title: true, phase: true, projectServiceId: true },
      });
      const existingKeys = new Set(
        existingTasks.map((t) => `${t.projectServiceId ?? 'none'}|${t.title}|${t.phase ?? ''}`)
      );

      const tasksToCreate: {
        title: string;
        phase: TaskPhase | null;
        projectId: bigint;
        projectServiceId?: bigint;
        businessId: bigint;
        status: 'TODO' | 'IN_PROGRESS' | 'DONE';
        dueDate?: Date;
      }[] = [];

      for (const ps of project.projectServices) {
        for (const tpl of ps.service.taskTemplates) {
          const dueDate =
            tpl.defaultDueOffsetDays != null ? new Date(now.getTime() + tpl.defaultDueOffsetDays * 86400000) : undefined;
          const key = `${ps.id}|${tpl.title}|${tpl.phase ?? ''}`;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          tasksToCreate.push({
            title: tpl.title,
            phase: (tpl.phase ?? null) as TaskPhase | null,
            projectId,
            projectServiceId: ps.id,
            businessId: ctx.businessId,
            status: 'TODO',
            dueDate,
          });
        }
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: { startedAt: now, status: 'ACTIVE' },
      });

      let createdCount = 0;
      if (tasksToCreate.length) {
        const created = await tx.task.createMany({
          data: tasksToCreate,
          skipDuplicates: true,
        });
        createdCount = created.count;
      }

      return { startedAt: updated.startedAt!, tasksCreated: createdCount };
    });

    return jsonb(
      {
        startedAt: result.startedAt,
        tasksCreated: result.tasksCreated,
      },
      ctx.requestId
    );
  }
);
