import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Action = { label: string; href: string };

type Props = {
  title: string;
  description?: string;
  primary?: Action;
  secondary?: Action;
};

export function GuidedCtaCard({ title, description, primary, secondary }: Props) {
  return (
    <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          {description ? <p className="text-xs text-[var(--text-secondary)]">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {primary ? (
            <Button asChild size="sm">
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
          ) : null}
          {secondary ? (
            <Button asChild size="sm" variant="outline">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
