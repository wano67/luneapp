import { useRef, useState } from 'react';
import type { Task } from './useTaskDetail';

export function useTaskForm(
  task: Task | null,
  isAdmin: boolean,
  patchTask: (payload: Record<string, unknown>) => Promise<boolean>,
) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  function startEditTitle() {
    if (!isAdmin || !task) return;
    setTitleDraft(task.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === task?.title) {
      setEditingTitle(false);
      return;
    }
    setSaving(true);
    await patchTask({ title: trimmed });
    setSaving(false);
    setEditingTitle(false);
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    await patchTask({ status: newStatus });
    setSaving(false);
  }

  async function handleDueDateChange(value: string) {
    if (!isAdmin) return;
    setSaving(true);
    await patchTask({ dueDate: value ? new Date(value).toISOString() : null });
    setSaving(false);
  }

  async function handleAssigneeChange(userId: string) {
    if (!isAdmin) return;
    setSaving(true);
    await patchTask({ assigneeUserId: userId || null });
    setSaving(false);
  }

  async function handleProjectChange(projectId: string) {
    if (!isAdmin) return;
    setSaving(true);
    await patchTask({ projectId: projectId || null });
    setSaving(false);
  }

  async function handleUnblock() {
    setSaving(true);
    await patchTask({ isBlocked: false, blockedReason: null });
    setSaving(false);
  }

  function startEditNotes() {
    if (!isAdmin || !task) return;
    setNotesDraft(task.notes ?? '');
    setEditingNotes(true);
  }

  async function saveNotes() {
    const trimmed = notesDraft.trim();
    if (trimmed === (task?.notes ?? '')) {
      setEditingNotes(false);
      return;
    }
    setSaving(true);
    await patchTask({ notes: trimmed || null });
    setSaving(false);
    setEditingNotes(false);
  }

  return {
    editingTitle,
    setEditingTitle,
    titleDraft,
    setTitleDraft,
    saving,
    titleInputRef,
    editingNotes,
    setEditingNotes,
    notesDraft,
    setNotesDraft,
    startEditTitle,
    saveTitle,
    handleStatusChange,
    handleDueDateChange,
    handleAssigneeChange,
    handleProjectChange,
    handleUnblock,
    startEditNotes,
    saveNotes,
  };
}
