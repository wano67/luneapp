import { useCallback, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';

type UseDocumentUploadOptions = {
  businessId: string;
  projectId: string;
  loadProjectDocuments: () => Promise<void>;
  onError: (msg: string | null) => void;
};

export function useDocumentUpload({
  businessId,
  projectId,
  loadProjectDocuments,
  onError,
}: UseDocumentUploadOptions) {
  const [uploading, setUploading] = useState(false);

  const uploadDocument = useCallback(async (file: File, title?: string) => {
    setUploading(true);
    onError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (title) form.append('title', title);

      const res = await fetch(`/api/pro/businesses/${businessId}/projects/${projectId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        onError((json as { error?: string })?.error ?? 'Upload impossible.');
        return;
      }
      await loadProjectDocuments();
    } catch {
      onError('Erreur réseau lors de l\u2019upload.');
    } finally {
      setUploading(false);
    }
  }, [businessId, projectId, loadProjectDocuments, onError]);

  const deleteDocument = useCallback(async (documentId: string) => {
    onError(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${projectId}/documents/${documentId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      onError(res.error ?? 'Suppression impossible.');
      return;
    }
    await loadProjectDocuments();
  }, [businessId, projectId, loadProjectDocuments, onError]);

  return { uploading, uploadDocument, deleteDocument };
}
