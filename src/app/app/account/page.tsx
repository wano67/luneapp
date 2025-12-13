// src/app/app/account/page.tsx
'use client';

import React from 'react';

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Compte</h1>
      <p className="text-sm text-[var(--text-secondary)]">
        Paramètres et informations du compte.
      </p>

      {/* TODO: Ajoute ici tes composants de settings */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm">Section à compléter</p>
      </div>
    </div>
  );
}
