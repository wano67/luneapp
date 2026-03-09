import { prisma } from '@/server/db/client';
import { TaskStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { ensureDelegate } from '@/server/http/delegates';
import { serializeTask } from '@/server/http/serializeTask';
import { dayKey, startOfWeek, addDays } from '@/lib/date';

// GET /api/pro/businesses/{businessId}/my-tasks
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const { requestId, businessId, userId } = ctx;

    const delegateError = ensureDelegate('task');
    if (delegateError) return delegateError;

    const tasks = await prisma.task.findMany({
      where: {
        businessId,
        status: { not: TaskStatus.DONE },
        OR: [
          { assigneeUserId: userId },
          { assignees: { some: { userId } } },
        ],
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        project: { select: { name: true } },
        projectService: { select: { id: true, service: { select: { name: true } } } },
        projectServiceStep: {
          select: { id: true, name: true, phaseName: true, isBillableMilestone: true },
        },
        assignee: { select: { id: true, email: true, name: true } },
        organizationUnit: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { assignedAt: 'asc' as const } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
        _count: { select: { subtasks: true, checklistItems: true } },
        checklistItems: { select: { isCompleted: true } },
      },
    });

    // Compute summary + active projects
    const now = new Date();
    const todayStr = dayKey(now);
    const monday = startOfWeek(now);
    const sundayStr = dayKey(addDays(monday, 6));

    let overdue = 0;
    let today = 0;
    let thisWeek = 0;
    let inProgress = 0;
    let blocked = 0;

    const projectMap = new Map<string, { id: string; name: string; taskCount: number; overdueCount: number }>();

    for (const task of tasks) {
      if (task.isBlocked) blocked++;
      if (task.status === TaskStatus.IN_PROGRESS) inProgress++;

      if (task.dueDate) {
        const dk = dayKey(task.dueDate);
        if (dk < todayStr) overdue++;
        else if (dk === todayStr) today++;
        else if (dk <= sundayStr) thisWeek++;
      }

      if (task.projectId && task.project?.name) {
        const pid = task.projectId.toString();
        const existing = projectMap.get(pid);
        if (existing) {
          existing.taskCount++;
          if (task.dueDate && dayKey(task.dueDate) < todayStr) existing.overdueCount++;
        } else {
          projectMap.set(pid, {
            id: pid,
            name: task.project.name,
            taskCount: 1,
            overdueCount: task.dueDate && dayKey(task.dueDate) < todayStr ? 1 : 0,
          });
        }
      }
    }

    const summary = { overdue, today, thisWeek, inProgress, blocked, total: tasks.length };
    const activeProjects = [...projectMap.values()].sort((a, b) => b.taskCount - a.taskCount);

    return jsonb({ items: tasks.map(serializeTask), summary, activeProjects }, requestId);
  }
);
