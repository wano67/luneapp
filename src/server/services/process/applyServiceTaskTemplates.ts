import { prisma } from '@/server/db/client';

type Params = {
  businessId: bigint;
  projectId: bigint;
  projectServiceId: bigint;
  assigneeUserId?: bigint | null;
  dueOffsetDaysOverride?: number | null;
};

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Applique les templates de tâches simples (ServiceTaskTemplate) sur une ligne ProjectService.
 * Idempotent : si des tâches existent déjà pour ce projectService, rien n'est créé.
 */
export async function applyServiceTaskTemplatesToProjectService({
  businessId,
  projectId,
  projectServiceId,
  assigneeUserId,
  dueOffsetDaysOverride,
}: Params): Promise<{ createdTasksCount: number }> {
  return prisma.$transaction(async (tx) => {
    const projectService = await tx.projectService.findFirst({
      where: { id: projectServiceId, projectId, project: { businessId } },
      select: { id: true, serviceId: true },
    });
    if (!projectService) return { createdTasksCount: 0 };

    const existingTasks = await tx.task.count({ where: { projectServiceId } });
    if (existingTasks > 0) return { createdTasksCount: 0 };

    const templates = await tx.serviceTaskTemplate.findMany({
      where: { serviceId: projectService.serviceId, service: { businessId } },
      orderBy: { position: 'asc' },
    });
    if (!templates.length) return { createdTasksCount: 0 };

    const now = new Date();
    let createdTasksCount = 0;
    for (const tpl of templates) {
      const offset = dueOffsetDaysOverride ?? tpl.defaultDueOffsetDays ?? null;
      const dueDate = offset != null ? addDays(now, offset) : undefined;
      await tx.task.create({
        data: {
          businessId,
          projectId,
          projectServiceId,
          title: tpl.title,
          phase: tpl.phase ?? undefined,
          status: 'TODO',
          dueDate,
          assigneeUserId: assigneeUserId ?? undefined,
        },
      });
      createdTasksCount += 1;
    }
    return { createdTasksCount };
  });
}
