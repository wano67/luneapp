import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  businessId: string | null;
  taskId: string | null;
  projectId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

/**
 * Hook for notifications.
 * - With businessId → business-scoped endpoints
 * - Without businessId → personal aggregate endpoints (cross-business)
 */
export function useNotifications(businessId?: string) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const base = businessId
    ? `/api/pro/businesses/${businessId}/notifications`
    : '/api/personal/notifications';

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<NotificationsResponse>(`${base}?limit=30`);
      if (res.ok && res.data) {
        setItems(res.data.items);
        setUnreadCount(res.data.unreadCount);
      }
    } finally {
      setLoading(false);
    }
  }, [base]);

  const pollUnreadCount = useCallback(async () => {
    try {
      const res = await fetchJson<NotificationsResponse>(`${base}?limit=0`);
      if (res.ok && res.data) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // silent
    }
  }, [base]);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await fetchJson(`${base}/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setItems((prev) => prev.map((n) => n.id === notificationId ? { ...n, isRead: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, [base]);

  const markAllRead = useCallback(async () => {
    try {
      await fetchJson(`${base}/read-all`, { method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, [base]);

  // Poll every 60s for unread count
  useEffect(() => {
    void pollUnreadCount();
    intervalRef.current = setInterval(() => void pollUnreadCount(), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollUnreadCount]);

  return { items, unreadCount, loading, loadNotifications, markRead, markAllRead };
}
