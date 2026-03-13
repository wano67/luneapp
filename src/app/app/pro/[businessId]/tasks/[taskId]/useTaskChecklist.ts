import { useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import type { ChecklistItem } from './useTaskDetail';

export function useTaskChecklist(
  businessId: string,
  taskId: string,
  isAdmin: boolean,
  checklistItems: ChecklistItem[],
  loadChecklist: (signal?: AbortSignal) => Promise<void>,
) {
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistSaving, setChecklistSaving] = useState(false);

  async function handleAddChecklistItem() {
    if (!isAdmin || checklistSaving) return;
    const title = checklistTitle.trim();
    if (!title) return;
    setChecklistSaving(true);
    const res = await fetchJson<{ item: ChecklistItem }>(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      },
    );
    if (res.ok) {
      setChecklistTitle('');
      await loadChecklist();
    }
    setChecklistSaving(false);
  }

  async function handleToggleChecklistItem(item: ChecklistItem, nextValue: boolean) {
    if (!isAdmin) return;
    await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: nextValue }),
      },
    );
    await loadChecklist();
  }

  async function handleDeleteChecklistItem(itemId: string) {
    if (!isAdmin) return;
    await fetchJson(
      `/api/pro/businesses/${businessId}/tasks/${taskId}/checklist/${itemId}`,
      { method: 'DELETE' },
    );
    await loadChecklist();
  }

  const checklistSorted = [...checklistItems].sort((a, b) => a.position - b.position);
  const checklistDone = checklistItems.filter((i) => i.isCompleted).length;
  const checklistTotal = checklistItems.length;

  return {
    checklistTitle,
    setChecklistTitle,
    checklistSaving,
    checklistSorted,
    checklistDone,
    checklistTotal,
    handleAddChecklistItem,
    handleToggleChecklistItem,
    handleDeleteChecklistItem,
  };
}
