import { useCallback, useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';

export type Task = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  parentTaskId: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  title: string;
  status: string;
  dueDate: string | null;
  notes: string | null;
  progress: number;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  position: number;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDocItem = { id: string; title: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string };

type TaskDetailResponse = { item: Task };
type ChecklistResponse = { items: ChecklistItem[] };

export type TeamMember = {
  userId: string;
  membershipId: string;
  name: string | null;
  email: string;
  role: string;
  organizationUnit: { id: string; name: string } | null;
};
export type ProjectOption = { id: string; name: string };
export type ProjectMember = {
  userId: string;
  name: string | null;
  email: string;
  implicit: boolean;
};

export function useTaskDetail(businessId: string, taskId: string, isAdmin: boolean) {
  const [task, setTask] = useState<Task | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState('');

  // Dropdown data
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // ─── Load checklist ──────────────────────────────────────────────────
  const loadChecklist = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetchJson<ChecklistResponse>(
        `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist`,
        {},
        signal,
      );
      if (res.ok && res.data) setChecklistItems(res.data.items ?? []);
    },
    [businessId, taskId],
  );

  // ─── Load task ───────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<TaskDetailResponse>(
          `/api/pro/businesses/${businessId}/tasks/${taskId}`,
          {},
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        if (!res.ok || !res.data) {
          setError(res.error ?? 'Tache introuvable.');
          setTask(null);
          return;
        }
        setTask(res.data.item);
        void loadChecklist(controller.signal);
      } catch {
        if (!controller.signal.aborted) setError('Impossible de charger la tache.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, taskId, loadChecklist]);

  // Load current user ID
  useEffect(() => {
    fetchJson<{ user: { id: string } }>('/api/auth/me').then((res) => {
      if (res.ok && res.data?.user?.id) setMyUserId(String(res.data.user.id));
    });
  }, []);

  // Load team members (for everyone -- needed for help request)
  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    fetchJson<{ items: TeamMember[] }>(
      `/api/pro/businesses/${businessId}/members`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setTeamMembers(res.data.items);
    });
    return () => controller.abort();
  }, [businessId]);

  // Load projects (admin only)
  useEffect(() => {
    if (!businessId || !isAdmin) return;
    const controller = new AbortController();
    fetchJson<{ items: ProjectOption[] }>(
      `/api/pro/businesses/${businessId}/projects?scope=ACTIVE`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setProjects(res.data.items);
    });
    return () => controller.abort();
  }, [businessId, isAdmin]);

  // Load project members when task has a project
  useEffect(() => {
    if (!businessId || !task?.projectId) return;
    const controller = new AbortController();
    fetchJson<{ items: ProjectMember[] }>(
      `/api/pro/businesses/${businessId}/projects/${task.projectId}/members`,
      {},
      controller.signal,
    ).then((res) => {
      if (res.ok && res.data) setProjectMembers(res.data.items);
    });
    return () => controller.abort();
  }, [businessId, task?.projectId]);

  // ─── PATCH helper ──────────────────────────────────────────────────
  const patchTask = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetchJson<TaskDetailResponse>(
        `/api/pro/businesses/${businessId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok && res.data) setTask(res.data.item);
      return res.ok;
    },
    [businessId, taskId],
  );

  return {
    task,
    loading,
    error,
    myUserId,
    teamMembers,
    projectMembers,
    projects,
    checklistItems,
    loadChecklist,
    patchTask,
  };
}
