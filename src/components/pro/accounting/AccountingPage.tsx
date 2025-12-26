"use client";

import Link from 'next/link';

type Props = { businessId: string };

const tabs = [
  { key: 'invoices', label: 'Factures' },
  { key: 'quotes', label: 'Devis' },
  { key: 'payments', label: 'Paiements' },
];

export default function AccountingPage({ businessId }: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            <Link href={`/app/pro/${businessId}`} className="hover:text-[var(--text-primary)]">
              ← Dashboard
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Comptabilité</h1>
          <p className="text-sm text-[var(--text-secondary)]">Factures, devis, paiements</p>
        </div>
        <Link
          href={`/app/pro/${businessId}/finances`}
          className="cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          Nouvelle opération
        </Link>
      </div>
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 text-sm text-[var(--text-secondary)]">
        Comptabilité (placeholder)
      </div>
    </div>
  );
}
