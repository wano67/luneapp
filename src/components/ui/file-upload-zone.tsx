'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const DEFAULT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.docx', '.xlsx', '.zip', '.txt',
]);

type FileUploadZoneProps = {
  label: string;
  uploading: boolean;
  disabled: boolean;
  accept?: string;
  maxSizeBytes?: number;
  onFile: (file: File) => void;
  onValidationError?: (msg: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function FileUploadZone({
  label,
  uploading,
  disabled,
  accept = '.pdf,.png,.jpg,.jpeg,.webp,.svg,.docx,.xlsx,.zip,.txt',
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  onFile,
  onValidationError,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Size check
      if (file.size === 0) return 'Le fichier est vide.';
      if (file.size > maxSizeBytes) return `Fichier trop volumineux (${formatBytes(file.size)}). Max : ${formatBytes(maxSizeBytes)}.`;

      // Type check
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
      if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
        return `Type de fichier non autorisé (${ext}). Types acceptés : PDF, images, documents Office, ZIP, TXT.`;
      }

      return null;
    },
    [maxSizeBytes]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;
      const file = files[0];
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        onValidationError?.(error);
        return;
      }
      setValidationError(null);
      onFile(file);
    },
    [disabled, onFile, validateFile, onValidationError]
  );

  return (
    <div className="space-y-1">
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
      {validationError ? <p className="px-1 text-xs text-[var(--danger)]">{validationError}</p> : null}
    </div>
  );
}
