import type { NotificationType } from '@/generated/prisma';

type NotificationRow = {
  id: bigint;
  userId: bigint;
  businessId: bigint;
  type: NotificationType;
  title: string;
  body: string | null;
  taskId: bigint | null;
  projectId: bigint | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export function serializeNotification(n: NotificationRow) {
  return {
    id: n.id.toString(),
    userId: n.userId.toString(),
    businessId: n.businessId.toString(),
    type: n.type,
    title: n.title,
    body: n.body,
    taskId: n.taskId?.toString() ?? null,
    projectId: n.projectId?.toString() ?? null,
    isRead: n.isRead,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
