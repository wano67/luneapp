// src/app/app/pro/businesses/page.tsx
import React, { Suspense } from 'react';
import ProHomeClient from '../ProHomeClient';

export default function BusinessesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-secondary)]">Chargement…</div>
      }
    >
      <ProHomeClient />
    </Suspense>
  );
}
