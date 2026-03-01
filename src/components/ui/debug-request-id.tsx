import { cn } from '@/lib/cn';

type DebugRequestIdProps = {
  requestId?: string | null;
  className?: string;
  prefix?: string;
};

export function DebugRequestId({
  requestId,
  className,
  prefix = 'Request ID:',
}: DebugRequestIdProps) {
  if (!requestId || process.env.NODE_ENV === 'production') return null;

  return (
    <p className={cn('text-[10px] text-[var(--text-faint)]', className)}>
      {prefix} <code>{requestId}</code>
    </p>
  );
}
