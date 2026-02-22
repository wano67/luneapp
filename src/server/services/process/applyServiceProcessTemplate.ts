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
 * Applique le template de process d'un service sur une ligne ProjectService.
 * Idempotent : si des steps ou tasks existent déjà pour ce projectService, rien n'est créé.
 */
export async function applyServiceProcessTemplateToProjectService({
  businessId,
  projectId,
  projectServiceId,
  assigneeUserId,
  dueOffsetDaysOverride,
}: Params): Promise<{ templateFound: boolean; createdStepsCount: number; createdTasksCount: number }> {
  return prisma.$transaction(async (tx) => {
    const projectService = await tx.projectService.findFirst({
      where: { id: projectServiceId, projectId, project: { businessId } },
      select: { id: true, serviceId: true },
    });
    if (!projectService) return { templateFound: false, createdStepsCount: 0, createdTasksCount: 0 };

    const template = await tx.serviceProcessTemplate.findFirst({
      where: { serviceId: projectService.serviceId, businessId },
      include: {
        phases: {
          orderBy: { order: 'asc' },
          include: {
            steps: {
              orderBy: { order: 'asc' },
              include: { tasks: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });

    if (!template) return { templateFound: false, createdStepsCount: 0, createdTasksCount: 0 };

    const existingSteps = await tx.projectServiceStep.count({ where: { projectServiceId } });
    const existingTasks = await tx.task.count({ where: { projectServiceId } });
    if (existingSteps > 0 || existingTasks > 0) {
      return { templateFound: true, createdStepsCount: 0, createdTasksCount: 0 };
    }

    let createdStepsCount = 0;
    let createdTasksCount = 0;
    const now = new Date();

    for (const phase of template.phases) {
      for (const step of phase.steps) {
        const createdStep = await tx.projectServiceStep.create({
          data: {
            projectServiceId,
            name: step.name,
            order: step.order,
            phaseName: phase.name,
            isBillableMilestone: step.isBillableMilestone,
          },
        });
        createdStepsCount += 1;

        for (const task of step.tasks) {
          const offset =
            dueOffsetDaysOverride != null
              ? dueOffsetDaysOverride
              : task.dueOffsetDays !== null && task.dueOffsetDays !== undefined
                ? task.dueOffsetDays
                : null;
          const dueDate = offset != null ? addDays(now, offset) : null;
          await tx.task.create({
            data: {
              businessId,
              projectId,
              projectServiceId,
              projectServiceStepId: createdStep.id,
              title: task.title,
              notes: task.description ?? undefined,
              status: 'TODO',
              dueDate: dueDate ?? undefined,
              assigneeUserId: assigneeUserId ?? undefined,
            },
          });
          createdTasksCount += 1;
        }
      }
    }

    return { templateFound: true, createdStepsCount, createdTasksCount };
  });
}
