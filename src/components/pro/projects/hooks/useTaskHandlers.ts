import { useCallback, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { revalidate } from '@/lib/revalidate';

interface UseTaskHandlersParams {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  loadTasks: () => Promise<void>;
  loadActivity: () => Promise<void>;
  loadProject: () => Promise<unknown>;
  onBillingError: (msg: string | null) => void;
}

export function useTaskHandlers(params: UseTaskHandlersParams) {
  const { businessId, isAdmin, loadTasks, loadActivity, loadProject, onBillingError } = params;
  const _toast = useToast();

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
        await Promise.all([loadTasks(), loadProject()]);
        revalidate('pro:tasks');
      } catch (err) {
        onBillingError(getErrorMessage(err));
      }
    },
    [businessId, loadTasks, loadProject, onBillingError]
  );

  const updateTask = useCallback(
    async (taskId: string, payload: Record<string, unknown>) => {
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
        await Promise.all([loadTasks(), loadProject()]);
        if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
          await loadActivity();
        }
        revalidate('pro:tasks');
      } catch (err) {
        onBillingError(getErrorMessage(err));
      } finally {
        setTaskUpdating((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [businessId, loadTasks, loadProject, loadActivity, onBillingError]
  );

  const createTask = useCallback(
    async (title: string, opts?: { projectServiceId?: string; assigneeUserIds?: string[]; organizationUnitId?: string }) => {
      onBillingError(null);
      try {
        const body: Record<string, unknown> = { title, projectId: params.projectId };
        if (opts?.projectServiceId) body.projectServiceId = opts.projectServiceId;
        if (opts?.assigneeUserIds && opts.assigneeUserIds.length > 0) body.assigneeUserIds = opts.assigneeUserIds;
        if (opts?.organizationUnitId) body.organizationUnitId = opts.organizationUnitId;
        const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          onBillingError(res.error ?? 'Impossible de créer la tâche.');
          return;
        }
        await Promise.all([loadTasks(), loadProject()]);
        revalidate('pro:tasks');
      } catch (err) {
        onBillingError(getErrorMessage(err));
      }
    },
    [businessId, params.projectId, loadTasks, loadProject, onBillingError]
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
        await Promise.all([loadTasks(), loadProject()]);
        revalidate('pro:tasks');
      } catch (err) {
        onBillingError(getErrorMessage(err));
      }
    },
    [isAdmin, businessId, loadTasks, loadProject, onBillingError]
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
        await Promise.all([loadTasks(), loadProject()]);
        revalidate('pro:tasks');
      } catch (err) {
        onBillingError(getErrorMessage(err));
      } finally {
        setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: false }));
      }
    },
    [isAdmin, businessId, params.projectId, loadTasks, loadProject, onBillingError]
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
