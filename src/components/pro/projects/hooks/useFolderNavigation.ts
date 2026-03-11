import { useCallback, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useRevalidation } from '@/lib/revalidate';

export type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  _count: { children: number; documents: number };
};

export type FolderDocument = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  folderId: string | null;
  createdAt: string;
};

type BreadcrumbItem = { id: string | null; name: string };

type UseFolderNavigationOptions = {
  businessId: string;
  projectId: string;
  onError: (msg: string | null) => void;
};

export function useFolderNavigation({ businessId, projectId, onError }: UseFolderNavigationOptions) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<BreadcrumbItem[]>([{ id: null, name: 'Racine' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<FolderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const folderIdRef = useRef<string | null>(null);
  const loadedRef = useRef<true | null>(null);

  const base = `/api/pro/businesses/${businessId}/projects/${projectId}`;

  const loadContents = useCallback(async (folderId: string | null) => {
    setLoading(true);
    onError(null);
    const qs = folderId ? `?parentId=${folderId}` : '';
    const res = await fetchJson<{ folders: FolderItem[]; documents: FolderDocument[] }>(
      `${base}/folders${qs}`
    );
    if (res.ok && res.data) {
      setFolders(res.data.folders);
      setDocuments(res.data.documents);
    } else {
      onError(getErrorMessage(res));
    }
    setLoading(false);
  }, [base, onError]);

  // Revalidation: reload current folder on external changes
  useRevalidation(['pro:documents'], () => void loadContents(folderIdRef.current));

  // Initial load + reload on folder navigation (called from navigateToFolder)
  const loadFolder = useCallback((folderId: string | null) => {
    void loadContents(folderId);
  }, [loadContents]);

  // Trigger initial load on first render (uses == null pattern for lint compliance)
  if (loadedRef.current == null) {
    loadedRef.current = true;
    void loadContents(null);
  }

  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    folderIdRef.current = folderId;
    setCurrentFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    loadFolder(folderId);
  }, [loadFolder]);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setFolderPath((prev) => {
      const target = prev[index];
      if (!target) return prev;
      folderIdRef.current = target.id;
      setCurrentFolderId(target.id);
      loadFolder(target.id);
      return prev.slice(0, index + 1);
    });
  }, [loadFolder]);

  const navigateUp = useCallback(() => {
    setFolderPath((prev) => {
      if (prev.length <= 1) return prev;
      const parent = prev[prev.length - 2];
      folderIdRef.current = parent.id;
      setCurrentFolderId(parent.id);
      loadFolder(parent.id);
      return prev.slice(0, -1);
    });
  }, [loadFolder]);

  const createFolder = useCallback(async (name: string) => {
    onError(null);
    const body: Record<string, string> = { name };
    if (folderIdRef.current) body.parentId = folderIdRef.current;
    const res = await fetchJson(`${base}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      onError(getErrorMessage(res));
      return false;
    }
    void loadContents(folderIdRef.current);
    return true;
  }, [base, loadContents, onError]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    onError(null);
    const res = await fetchJson(`${base}/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      onError(getErrorMessage(res));
      return false;
    }
    void loadContents(folderIdRef.current);
    return true;
  }, [base, loadContents, onError]);

  const deleteFolder = useCallback(async (folderId: string) => {
    onError(null);
    const res = await fetchJson(`${base}/folders/${folderId}`, { method: 'DELETE' });
    if (!res.ok) {
      onError(getErrorMessage(res));
      return false;
    }
    void loadContents(folderIdRef.current);
    return true;
  }, [base, loadContents, onError]);

  const moveDocument = useCallback(async (documentId: string, targetFolderId: string | null) => {
    onError(null);
    const res = await fetchJson(`${base}/documents/${documentId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: targetFolderId }),
    });
    if (!res.ok) {
      onError(getErrorMessage(res));
      return false;
    }
    void loadContents(folderIdRef.current);
    return true;
  }, [base, loadContents, onError]);

  const refresh = useCallback(() => {
    void loadContents(folderIdRef.current);
  }, [loadContents]);

  return {
    currentFolderId,
    folderPath,
    folders,
    documents,
    loading,
    navigateToFolder,
    navigateToBreadcrumb,
    navigateUp,
    createFolder,
    renameFolder,
    deleteFolder,
    moveDocument,
    refresh,
  };
}
