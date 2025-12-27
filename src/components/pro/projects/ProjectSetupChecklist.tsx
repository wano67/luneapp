import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  ctaLabel: string;
  href: string;
};

export function ProjectSetupChecklist({
  items,
  onAction,
}: {
  items: ChecklistItem[];
  onAction?: (key: string) => void;
}) {
  if (!items.some((it) => !it.done)) return null;

  return (
    <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Checklist de mise en place</p>
          <p className="text-xs text-[var(--text-secondary)]">Complète ces étapes pour lancer le projet.</p>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          {items.filter((it) => it.done).length}/{items.length} complétées
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-xl border border-[var(--border)]/70 bg-[var(--surface-2)]/70 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle2 size={16} className="text-emerald-500" aria-hidden />
              ) : (
                <Circle size={16} className="text-[var(--text-secondary)]" aria-hidden />
              )}
              <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
            </div>
            {item.done ? (
              <Button asChild size="sm" variant="outline" className="gap-1">
                <Link href={item.href}>Voir</Link>
              </Button>
            ) : onAction ? (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onAction(item.key)}>
                {item.ctaLabel}
                <ChevronRight size={14} />
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="gap-1">
                <Link href={item.href}>
                  {item.ctaLabel}
                  <ChevronRight size={14} />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
