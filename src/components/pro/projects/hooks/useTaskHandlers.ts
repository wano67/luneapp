import { useCallback, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

interface UseTaskHandlersParams {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  loadTasks: () => Promise<void>;
  loadActivity: () => Promise<void>;
  onBillingError: (msg: string | null) => void;
}

export function useTaskHandlers(params: UseTaskHandlersParams) {
  const { businessId, isAdmin, loadTasks, loadActivity, onBillingError } = params;

  const [taskGroupExpanded, setTaskGroupExpanded] = useState<Record<string, boolean>>({});
  const [taskRowExpanded, setTaskRowExpanded] = useState<Record<string, boolean>>({});
  const [openServiceTasks, setOpenServiceTasks] = useState<Record<string, boolean>>({});
  const [taskUpdating, setTaskUpdating] = useState<Record<string, boolean>>({});
  const [templatesApplying, setTemplatesApplying] = useState<Record<string, boolean>>({});

  const updateTaskDueDate = useCallback(
    async (taskId: string, value: string) => {
      try {
        const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dueDate: value || null }),
        });
        if (!res.ok) {
          onBillingError(res.error ?? 'Impossible de mettre à jour la date.');
          return;
        }
        await loadTasks();
      } catch (err) {
        onBillingError(getErrorMessage(err));
      }
    },
    [businessId, loadTasks, onBillingError]
  );

  const updateTask = useCallback(
    async (taskId: string, payload: Record<string, unknown>) => {
      if (!isAdmin) {
        onBillingError('Réservé aux admins/owners.');
        return;
      }
      setTaskUpdating((prev) => ({ ...prev, [taskId]: true }));
      try {
        onBillingError(null);
        const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          onBillingError(res.error ?? 'Impossible de mettre à jour la tâche.');
          return;
        }
        await loadTasks();
        if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
          await loadActivity();
        }
      } catch (err) {
        onBillingError(getErrorMessage(err));
      } finally {
        setTaskUpdating((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [isAdmin, businessId, loadTasks, loadActivity, onBillingError]
  );

  const createTask = useCallback(
    async (title: string, projectServiceId?: string) => {
      if (!isAdmin) {
        onBillingError('Réservé aux admins/owners.');
        return;
      }
      onBillingError(null);
      try {
        const body: Record<string, unknown> = { title, projectId: params.projectId };
        if (projectServiceId) body.projectServiceId = projectServiceId;
        const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          onBillingError(res.error ?? 'Impossible de créer la tâche.');
          return;
        }
        await loadTasks();
      } catch (err) {
        onBillingError(getErrorMessage(err));
      }
    },
    [isAdmin, businessId, params.projectId, loadTasks, onBillingError]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!isAdmin) {
        onBillingError('Réservé aux admins/owners.');
        return;
      }
      onBillingError(null);
      try {
        const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          onBillingError(res.error ?? 'Impossible de supprimer la tâche.');
          return;
        }
        await loadTasks();
      } catch (err) {
        onBillingError(getErrorMessage(err));
      }
    },
    [isAdmin, businessId, loadTasks, onBillingError]
  );

  const handleApplyServiceTemplates = useCallback(
    async (projectServiceId: string, taskAssigneeId: string, taskDueOffsetDays: string) => {
      if (!isAdmin) {
        onBillingError('Réservé aux admins/owners.');
        return;
      }
      const dueOffset =
        taskDueOffsetDays.trim() === ''
          ? null
          : Number.isFinite(Number(taskDueOffsetDays))
            ? Math.trunc(Number(taskDueOffsetDays))
            : null;
      if (dueOffset !== null && (dueOffset < 0 || dueOffset > 365)) {
        onBillingError('Décalage jours invalide (0-365).');
        return;
      }
      setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: true }));
      onBillingError(null);
      try {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/projects/${params.projectId}/services/${projectServiceId}/tasks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(taskAssigneeId ? { taskAssigneeUserId: taskAssigneeId } : {}),
              ...(dueOffset !== null ? { taskDueOffsetDays: dueOffset } : {}),
            }),
          }
        );
        if (!res.ok) {
          onBillingError(res.error ?? 'Impossible de générer les tâches.');
          return;
        }
        await loadTasks();
      } catch (err) {
        onBillingError(getErrorMessage(err));
      } finally {
        setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: false }));
      }
    },
    [isAdmin, businessId, params.projectId, loadTasks, onBillingError]
  );

  return {
    taskGroupExpanded,
    setTaskGroupExpanded,
    taskRowExpanded,
    setTaskRowExpanded,
    openServiceTasks,
    setOpenServiceTasks,
    taskUpdating,
    templatesApplying,
    updateTaskDueDate,
    updateTask,
    createTask,
    deleteTask,
    handleApplyServiceTemplates,
  };
}
