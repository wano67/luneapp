'use client';

import type { ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type DropHandler = (files: FileList | File[]) => void;

type FileDropContextValue = {
  registerDropHandler: (handler: DropHandler | null) => () => void;
  isDragging: boolean;
};

const FileDropContext = createContext<FileDropContextValue | null>(null);

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function GlobalFileDropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[68] bg-[var(--surface)]/60 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex max-w-md flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--background)]/80 px-6 py-5 text-center shadow-2xl shadow-[var(--shadow-float)]/40">
          <p className="text-lg font-semibold text-[var(--text-primary)]">Déposez pour importer</p>
          <p className="text-sm text-[var(--text-secondary)]">CSV uniquement</p>
        </div>
      </div>
    </div>
  );
}

export function FileDropProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<DropHandler[]>([]);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const registerDropHandler = useCallback((handler: DropHandler | null) => {
    if (!handler) return () => {};
    handlersRef.current = [...handlersRef.current, handler];
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event) || handlersRef.current.length === 0) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event) || handlersRef.current.length === 0) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event) || handlersRef.current.length === 0) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) {
        setIsDragging(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event) || handlersRef.current.length === 0) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const handler = handlersRef.current[handlersRef.current.length - 1];
      handler?.(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const value = useMemo(
    () => ({
      registerDropHandler,
      isDragging,
    }),
    [registerDropHandler, isDragging]
  );

  return (
    <FileDropContext.Provider value={value}>
      {children}
      <GlobalFileDropOverlay visible={isDragging} />
    </FileDropContext.Provider>
  );
}

export function useFileDropHandler(handler: DropHandler | null, options?: { enabled?: boolean }) {
  const ctx = useContext(FileDropContext);

  useEffect(() => {
    if (!ctx || !handler || options?.enabled === false) return;
    return ctx.registerDropHandler(handler);
  }, [ctx, handler, options?.enabled]);

  return ctx?.isDragging ?? false;
}
