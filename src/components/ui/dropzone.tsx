'use client';

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

type DropzoneProps = {
  label?: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  onFiles: (files: FileList | File[]) => void;
  fileName?: string | null;
  error?: string | null;
};

export function Dropzone({ label, hint, accept, disabled, onFiles, fileName, error }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files || disabled) return;
      onFiles(files);
    },
    [disabled, onFiles]
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // allow re-uploading the same file
    e.target.value = '';
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDragOver(true);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragOver(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {label ? <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span> : null}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative flex min-h-[104px] cursor-pointer flex-col justify-center gap-2 rounded-2xl border bg-[var(--surface-2)] px-4 py-3 text-center transition-colors',
          dragOver
            ? 'border-[var(--focus-ring)] bg-[var(--surface-hover)]/80 text-[var(--text-primary)]'
            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
          disabled ? 'cursor-not-allowed opacity-60' : '',
          error ? 'border-[var(--danger)] text-[var(--danger)]' : ''
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onInputChange}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="flex flex-col items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 12v6.2A1.8 1.8 0 0 0 7.8 20h8.4a1.8 1.8 0 0 0 1.8-1.8V12" strokeLinecap="round" />
            </svg>
            <span>Déposer un fichier CSV</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {fileName ? (
              <span className="flex items-center gap-2">
                <span className="max-w-[200px] truncate" title={fileName}>
                  Sélectionné : {fileName}
                </span>
                <span className="text-[var(--text-primary)] underline underline-offset-4">Changer</span>
              </span>
            ) : (
              hint ?? 'ou cliquer pour sélectionner'
            )}
          </p>
        </div>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export default Dropzone;
