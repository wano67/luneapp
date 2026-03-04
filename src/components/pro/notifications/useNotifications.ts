import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
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

export function useNotifications(businessId: string | undefined) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<NotificationsResponse>(`/api/pro/businesses/${businessId}/notifications?limit=30`);
      if (res.ok && res.data) {
        setItems(res.data.items);
        setUnreadCount(res.data.unreadCount);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const pollUnreadCount = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetchJson<NotificationsResponse>(`/api/pro/businesses/${businessId}/notifications?limit=0`);
      if (res.ok && res.data) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // silent
    }
  }, [businessId]);

  const markRead = useCallback(async (notificationId: string) => {
    if (!businessId) return;
    try {
      await fetchJson(`/api/pro/businesses/${businessId}/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setItems((prev) => prev.map((n) => n.id === notificationId ? { ...n, isRead: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, [businessId]);

  const markAllRead = useCallback(async () => {
    if (!businessId) return;
    try {
      await fetchJson(`/api/pro/businesses/${businessId}/notifications/read-all`, {
        method: 'POST',
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, [businessId]);

  // Poll every 60s for unread count
  useEffect(() => {
    if (!businessId) return;
    void pollUnreadCount();
    intervalRef.current = setInterval(() => void pollUnreadCount(), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [businessId, pollUnreadCount]);

  return { items, unreadCount, loading, loadNotifications, markRead, markAllRead };
}
