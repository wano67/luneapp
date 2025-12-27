import Link from 'next/link';

type Props = { businessId: string; projectId: string };

const tabs = [
  { key: 'overview', label: 'Vue d’ensemble' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'scope', label: 'Périmètre' },
  { key: 'billing', label: 'Facturation' },
  { key: 'costs', label: 'Charges' },
  { key: 'files', label: 'Fichiers' },
];

export default function ProjectHub({ businessId, projectId }: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            <Link href={`/app/pro/${businessId}/projects`} className="hover:text-[var(--text-primary)]">
              ← Projets
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Projet #{projectId}</h1>
          <p className="text-sm text-[var(--text-secondary)]">Hub projet premium</p>
        </div>
        <Link
          href={`/app/pro/${businessId}/projects/${projectId}/edit`}
          className="w-full rounded-md bg-neutral-900 px-3 py-1.5 text-center text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:w-auto"
        >
          Actions
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
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
        Contenu {tabs.map((t) => t.label).join(' / ')} (placeholder)
      </div>
    </div>
  );
}
