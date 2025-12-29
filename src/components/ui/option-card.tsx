import { cn } from '@/lib/cn';
import { Check } from 'lucide-react';

type OptionCardProps = {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function OptionCard({ title, description, checked, onChange, disabled }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'w-full rounded-xl border px-3 py-2 text-left transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
        checked ? 'border-[var(--border)] bg-[var(--surface)]/80 shadow-sm' : 'border-[var(--border)] bg-[var(--surface)]/50',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-[var(--surface-hover)]'
      )}
      aria-pressed={checked}
      aria-disabled={disabled}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 items-center justify-center rounded border',
            checked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface-2)]'
          )}
          aria-hidden
        >
          {checked ? <Check size={14} /> : null}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          {description ? <p className="text-xs text-[var(--text-secondary)]">{description}</p> : null}
        </div>
      </div>
    </button>
  );
}
