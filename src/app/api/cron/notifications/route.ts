import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProjectStatus, TaskStatus } from '@/generated/prisma';
import { notifyProjectOverdue, notifyTaskDueSoon } from '@/server/services/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let projectCount = 0;
  let taskCount = 0;

  // ── 1. Overdue projects ──
  const overdueProjects = await prisma.project.findMany({
    where: {
      endDate: { lt: now },
      status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
      NOT: {
        notifications: {
          some: {
            type: 'PROJECT_OVERDUE',
            createdAt: { gte: todayStart },
          },
        },
      },
    },
    select: { id: true, businessId: true, name: true },
  });

  for (const project of overdueProjects) {
    await notifyProjectOverdue(project.id, project.businessId, project.name);
    projectCount++;
  }

  // ── 2. Tasks due soon (within 24 hours) ──
  const dueSoonTasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: now, lte: in24h },
      status: { not: TaskStatus.DONE },
      NOT: {
        notifications: {
          some: {
            type: 'TASK_DUE_SOON',
            createdAt: { gte: todayStart },
          },
        },
      },
    },
    select: { id: true, businessId: true, title: true, projectId: true },
  });

  for (const task of dueSoonTasks) {
    await notifyTaskDueSoon(task.id, task.businessId, task.title, task.projectId);
    taskCount++;
  }

  return NextResponse.json({
    ok: true,
    processed: { projects: projectCount, tasks: taskCount },
    timestamp: now.toISOString(),
  });
}
