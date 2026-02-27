'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function BusinessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[BusinessError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md space-y-4 p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
          Erreur inattendue
        </p>
        <p className="text-base font-semibold text-[var(--text-primary)]">
          Une erreur est survenue sur cette page.
        </p>
        {error.digest ? (
          <p className="text-xs text-[var(--text-secondary)]">Ref: {error.digest}</p>
        ) : null}
        <Button onClick={reset}>Réessayer</Button>
      </Card>
    </div>
  );
}
