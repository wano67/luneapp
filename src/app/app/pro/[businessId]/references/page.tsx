// src/app/app/pro/[businessId]/references/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getMockAutomations,
  getMockCategories,
  getMockNumbering,
  getMockTags,
} from '../../pro-data';
import { usePersistentState } from '../../usePersistentState';

export default function ReferencesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [categories] = usePersistentState(`refs-categories:${businessId}`, getMockCategories());
  const [tags] = usePersistentState(`refs-tags:${businessId}`, getMockTags());
  const [automations] = usePersistentState(
    `refs-automations:${businessId}`,
    getMockAutomations()
  );
  const [numbering] = usePersistentState(`refs-numbering:${businessId}`, getMockNumbering());

  const links = [
    {
      href: `/app/pro/${businessId}/references/categories`,
      label: 'Categories',
      desc: 'Catégories pour revenus/dépenses',
      count: categories.length,
    },
    {
      href: `/app/pro/${businessId}/references/tags`,
      label: 'Tags',
      desc: 'Étiquettes globales',
      count: tags.length,
    },
    {
      href: `/app/pro/${businessId}/references/automations`,
      label: 'Automations',
      desc: 'Règles et SOP',
      count: automations.length,
    },
    {
      href: `/app/pro/${businessId}/references/numbering`,
      label: 'Numbering',
      desc: 'Paramètres de numérotation',
      count: numbering.length,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · References
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Référentiels</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Gère les référentiels communs de Business #{businessId}.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((link) => (
          <Card key={link.href} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{link.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {link.desc} · {link.count} éléments
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={link.href}>Ouvrir</Link>
              </Button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Mock persistant dans le navigateur, prêt pour branchement API.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
