import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProjectStatus, TaskStatus } from '@/generated/prisma';
import {
  notifyProjectOverdue,
  notifyTaskDueSoon,
  notifyTaskOverdue,
  notifyCalendarReminder,
  notifyClientFollowup,
  notifyProspectFollowup,
} from '@/server/services/notifications';

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
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

  let projectCount = 0;
  let taskDueSoonCount = 0;
  let taskOverdueCount = 0;
  let calendarCount = 0;
  let clientCount = 0;
  let prospectCount = 0;

  // ── 1. Overdue projects ──
  const overdueProjects = await prisma.project.findMany({
    where: {
      endDate: { lt: now },
      status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
      NOT: {
        notifications: {
          some: {
            type: 'PROJECT_OVERDUE',
            createdAt: { gte: oneDayAgo },
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
            createdAt: { gte: oneDayAgo },
          },
        },
      },
    },
    select: { id: true, businessId: true, title: true, projectId: true },
  });

  for (const task of dueSoonTasks) {
    await notifyTaskDueSoon(task.id, task.businessId, task.title, task.projectId);
    taskDueSoonCount++;
  }

  // ── 3. Tasks overdue (past dueDate, not done) ──
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: now },
      status: { not: TaskStatus.DONE },
      NOT: {
        notifications: {
          some: {
            type: 'TASK_OVERDUE',
            createdAt: { gte: oneDayAgo },
          },
        },
      },
    },
    select: { id: true, businessId: true, title: true, projectId: true },
  });

  for (const task of overdueTasks) {
    await notifyTaskOverdue(task.id, task.businessId, task.title, task.projectId);
    taskOverdueCount++;
  }

  // ── 4. Calendar reminders (remindAt <= now, startAt > now) ──
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      remindAt: { lte: now },
      startAt: { gt: now },
      NOT: {
        notifications: {
          some: {
            type: 'CALENDAR_REMINDER',
            createdAt: { gte: oneDayAgo },
          },
        },
      },
    },
    select: { id: true, businessId: true, userId: true, title: true, startAt: true },
  });

  for (const event of calendarEvents) {
    await notifyCalendarReminder(event.id, event.businessId, event.userId, event.title, event.startAt);
    calendarCount++;
  }

  // ── 5. Client follow-up (no interaction for 21+ days, dedup 7 days) ──
  const staleClients = await prisma.client.findMany({
    where: {
      status: 'ACTIVE',
      interactions: {
        none: {
          happenedAt: { gte: twentyOneDaysAgo },
        },
      },
      NOT: {
        notifications: {
          some: {
            type: 'CLIENT_FOLLOWUP',
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      interactions: {
        orderBy: { happenedAt: 'desc' },
        take: 1,
        select: { happenedAt: true },
      },
    },
  });

  for (const client of staleClients) {
    const lastDate = client.interactions[0]?.happenedAt;
    const daysSince = lastDate
      ? Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))
      : 999;
    await notifyClientFollowup(client.id, client.businessId, client.name, daysSince);
    clientCount++;
  }

  // ── 6. Prospect follow-up (not followed up in 24h, active statuses) ──
  const staleProspects = await prisma.prospect.findMany({
    where: {
      status: { in: ['NEW', 'FOLLOW_UP'] },
      updatedAt: { lt: oneDayAgo },
      NOT: {
        notifications: {
          some: {
            type: 'PROSPECT_FOLLOWUP',
            createdAt: { gte: oneDayAgo },
          },
        },
      },
    },
    select: { id: true, businessId: true, name: true },
  });

  for (const prospect of staleProspects) {
    await notifyProspectFollowup(prospect.id, prospect.businessId, prospect.name);
    prospectCount++;
  }

  return NextResponse.json({
    ok: true,
    processed: {
      projects: projectCount,
      tasksDueSoon: taskDueSoonCount,
      tasksOverdue: taskOverdueCount,
      calendarReminders: calendarCount,
      clientFollowups: clientCount,
      prospectFollowups: prospectCount,
    },
    timestamp: now.toISOString(),
  });
}
