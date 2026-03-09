import { prisma } from '@/server/db/client';
import { TaskStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { forbidden } from '@/server/http/apiUtils';
import { dayKey, startOfWeek, addDays } from '@/lib/date';
import { parseId } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/tasks/weekly-stats?userId=xxx
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const { requestId, businessId, userId: callerId, membership } = ctx;

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId');

    let targetUserId = callerId;
    if (userIdParam) {
      const role = membership.role;
      if (role !== 'OWNER' && role !== 'ADMIN') {
        return forbidden();
      }
      targetUserId = parseId(userIdParam);
    }

    // Week boundaries (Monday 00:00 → next Monday 00:00)
    const now = new Date();
    const monday = startOfWeek(now);
    const nextMonday = addDays(monday, 7);

    // Tasks completed this week
    const completedTasks = await prisma.task.findMany({
      where: {
        businessId,
        status: TaskStatus.DONE,
        completedAt: { gte: monday, lt: nextMonday },
        OR: [
          { assigneeUserId: targetUserId },
          { assignees: { some: { userId: targetUserId } } },
        ],
      },
      select: { id: true, completedAt: true },
    });

    // Pending tasks assigned to user (due this week or no date)
    const pendingTasks = await prisma.task.count({
      where: {
        businessId,
        status: { not: TaskStatus.DONE },
        OR: [
          { assigneeUserId: targetUserId },
          { assignees: { some: { userId: targetUserId } } },
        ],
        AND: [
          {
            OR: [
              { dueDate: null },
              { dueDate: { lt: nextMonday } },
            ],
          },
        ],
      },
    });

    const completedThisWeek = completedTasks.length;
    const totalThisWeek = completedThisWeek + pendingTasks;
    const percentComplete = totalThisWeek > 0
      ? Math.round((completedThisWeek / totalThisWeek) * 100)
      : 0;

    // Group completed by day
    const completedByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      completedByDay[dayKey(addDays(monday, i))] = 0;
    }
    for (const task of completedTasks) {
      if (task.completedAt) {
        const dk = dayKey(task.completedAt);
        if (dk in completedByDay) {
          completedByDay[dk]++;
        }
      }
    }

    // Get target user name
    const targetUser = targetUserId !== callerId
      ? await prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } })
      : null;

    return jsonb({
      completedThisWeek,
      pendingThisWeek: pendingTasks,
      totalThisWeek,
      percentComplete,
      completedByDay,
      userName: targetUser?.name ?? null,
      userId: targetUserId.toString(),
    }, requestId);
  }
);
