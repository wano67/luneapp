import type { TaskPhase, TaskStatus } from '@/generated/prisma';

type TaskRow = {
  id: bigint;
  businessId: bigint;
  projectId: bigint | null;
  projectServiceId?: bigint | null;
  projectServiceStepId?: bigint | null;
  parentTaskId?: bigint | null;
  assigneeUserId: bigint | null;
  organizationUnitId?: bigint | null;
  organizationUnit?: { id: bigint; name: string } | null;
  assignees?: Array<{ userId: bigint; user: { id: bigint; email: string; name: string | null } }>;
  title: string;
  phase: TaskPhase | null;
  status: TaskStatus;
  progress: number;
  dueDate: Date | null;
  startDate: Date | null;
  completedAt: Date | null;
  notes: string | null;
  estimatedMinutes?: number | null;
  isBlocked?: boolean;
  blockedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string | null } | null;
  projectService?: { id: bigint; service: { name: string } } | null;
  projectServiceStep?: { id: bigint; name: string; phaseName: string | null; isBillableMilestone: boolean } | null;
  assignee?: { id: bigint; email: string; name: string | null } | null;
  categoryReferenceId?: bigint | null;
  categoryReference?: { id: bigint; name: string | null } | null;
  tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
  _count?: { subtasks: number; checklistItems: number };
  checklistItems?: Array<{ isCompleted: boolean }>;
};

export function serializeTask(task: TaskRow) {
  const checklistDone = task.checklistItems
    ? task.checklistItems.filter((item) => item.isCompleted).length
    : undefined;
  return {
    id: task.id.toString(),
    businessId: task.businessId.toString(),
    projectId: task.projectId ? task.projectId.toString() : null,
    projectName: task.project?.name ?? null,
    projectServiceId: task.projectServiceId ? task.projectServiceId.toString() : null,
    projectServiceName: task.projectService?.service.name ?? null,
    projectServiceStepId: task.projectServiceStepId ? task.projectServiceStepId.toString() : null,
    projectServiceStepName: task.projectServiceStep?.name ?? null,
    projectServiceStepPhaseName: task.projectServiceStep?.phaseName ?? null,
    projectServiceStepIsBillableMilestone: task.projectServiceStep?.isBillableMilestone ?? false,
    parentTaskId: task.parentTaskId ? task.parentTaskId.toString() : null,
    assigneeUserId: task.assigneeUserId ? task.assigneeUserId.toString() : null,
    assigneeEmail: task.assignee?.email ?? null,
    assigneeName: task.assignee?.name ?? null,
    organizationUnitId: task.organizationUnitId ? task.organizationUnitId.toString() : null,
    organizationUnitName: task.organizationUnit?.name ?? null,
    assignees: task.assignees?.map((a) => ({
      userId: a.user.id.toString(),
      email: a.user.email,
      name: a.user.name,
    })) ?? [],
    categoryReferenceId: task.categoryReferenceId ? task.categoryReferenceId.toString() : null,
    categoryReferenceName: task.categoryReference?.name ?? null,
    tagReferences: task.tags
      ? task.tags.map((tag) => ({
          id: tag.reference.id.toString(),
          name: tag.reference.name,
        }))
      : [],
    title: task.title,
    phase: task.phase,
    status: task.status,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    notes: task.notes,
    estimatedMinutes: task.estimatedMinutes ?? null,
    isBlocked: task.isBlocked ?? false,
    blockedReason: task.blockedReason ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    subtasksCount: typeof task._count?.subtasks === 'number' ? task._count.subtasks : undefined,
    checklistCount: typeof task._count?.checklistItems === 'number' ? task._count.checklistItems : undefined,
    checklistDoneCount: typeof checklistDone === 'number' ? checklistDone : undefined,
  };
}
