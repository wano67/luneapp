// src/app/app/pro/page.tsx

import ProHomeClient from './ProHomeClient';

export default function ProHomePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          ESPACE PRO
        </p>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          DASHBOARD
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Pilote tes entreprises, tes clients et tes projets depuis un seul endroit.
        </p>
      </header>

      <ProHomeClient />
    </div>
  );
}
