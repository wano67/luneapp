import { useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import type { Task, TaskDocItem } from './useTaskDetail';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 Mo
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.docx', '.xlsx', '.zip', '.txt',
]);

export function useTaskDocuments(businessId: string, task: Task | null) {
  const [taskDocs, setTaskDocs] = useState<TaskDocItem[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const taskProjectId = task?.projectId;
  const taskId = task?.id;

  useEffect(() => {
    if (!taskProjectId || !taskId) return;
    let cancelled = false;
    fetchJson<{ items: TaskDocItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${taskProjectId}/documents?taskId=${taskId}`,
    ).then((res) => {
      if (!cancelled && res.ok && res.data) setTaskDocs(res.data.items);
    });
    return () => { cancelled = true; };
  }, [businessId, taskId, taskProjectId, reloadKey]);

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !task?.projectId) return;
    setDocError(null);

    // Client-side validation
    if (file.size === 0) { setDocError('Le fichier est vide.'); return; }
    if (file.size > MAX_UPLOAD_BYTES) {
      setDocError(`Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Max : 20 Mo.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      setDocError(`Type de fichier non autorisé (${ext}).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setDocUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', file.name);
    fd.append('taskId', task.id);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${task.projectId}/documents`,
      { method: 'POST', body: fd },
    );
    if (!res.ok) {
      setDocError(res.error ?? 'Erreur lors de l\'upload.');
    }
    setDocUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setReloadKey((k) => k + 1);
  }

  async function handleDocDelete(docId: string) {
    if (!task?.projectId) return;
    await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${task.projectId}/documents/${docId}`,
      { method: 'DELETE' },
    );
    setReloadKey((k) => k + 1);
  }

  return {
    taskDocs,
    docUploading,
    docError,
    fileInputRef,
    handleDocUpload,
    handleDocDelete,
  };
}
