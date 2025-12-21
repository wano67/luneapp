'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ComingSoonProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

export function ComingSoon({ title, description, backHref = '/app', backLabel = 'Retour' }: ComingSoonProps) {
  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Badge variant="neutral">À venir</Badge>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {description ? <p className="text-sm text-[var(--text-secondary)]">{description}</p> : null}
        </div>
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Cette section sera activée une fois l’API prête. En attendant, continue sur les écrans disponibles.
      </p>
    </Card>
  );
}
