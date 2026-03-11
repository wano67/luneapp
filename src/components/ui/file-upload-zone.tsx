'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

type FileUploadZoneProps = {
  label: string;
  uploading: boolean;
  disabled: boolean;
  accept?: string;
  onFile: (file: File) => void;
};

export function FileUploadZone({
  label,
  uploading,
  disabled,
  accept = '.pdf,.png,.jpg,.jpeg,.webp,.svg,.docx,.xlsx,.zip,.txt',
  onFile,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;
      onFile(files[0]);
    },
    [disabled, onFile]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors',
        dragOver
          ? 'border-[var(--accent)] bg-[var(--surface-hover)] text-[var(--text-primary)]'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]',
        disabled ? 'cursor-not-allowed opacity-60' : ''
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        disabled={disabled}
        className="hidden"
      />
      {uploading ? 'Upload en cours\u2026' : label}
    </div>
  );
}
