import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type BulkAction = {
  label: string;
  onClick: () => void | Promise<void>;
  icon?: ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
};

type BulkActionBarProps = {
  count: number;
  onClear: () => void;
  actions: BulkAction[];
};

export function BulkActionBar({ count, onClear, actions }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-30 flex w-[min(960px,calc(100%-24px))] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-lg shadow-black/10 backdrop-blur">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{count} sélectionné{count > 1 ? 's' : ''}</div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant ?? 'outline'}
            onClick={action.onClick}
            disabled={action.disabled}
            className="flex items-center gap-2"
          >
            {action.icon}
            <span>{action.label}</span>
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClear}>
          Tout désélectionner
        </Button>
      </div>
    </div>
  );
}
