"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Props = { businessId: string };

const tabs = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'En cours' },
  { key: 'done', label: 'Terminés' },
];

export default function ProjectsPage({ businessId }: Props) {
  const search = useSearchParams();
  const current = search?.get('tab') ?? 'all';

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Projets</h1>
        <Link
          href={`/app/pro/${businessId}/projects/new`}
          className="cursor-pointer rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          Nouveau projet
        </Link>
      </div>
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/app/pro/${businessId}/projects?tab=${tab.key}`}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
              current === tab.key
                ? 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 text-sm text-[var(--text-secondary)]">
        Liste des projets ({tabs.find((t) => t.key === current)?.label})
      </div>
    </div>
  );
}
