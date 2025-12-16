// src/app/app/pro/[businessId]/references/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReferencesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const links = [
    { href: `/app/pro/${businessId}/references/categories`, label: 'Categories', desc: 'Catégories pour revenus/dépenses' },
    { href: `/app/pro/${businessId}/references/tags`, label: 'Tags', desc: 'Étiquettes globales' },
    { href: `/app/pro/${businessId}/references/automations`, label: 'Automations', desc: 'Règles et SOP' },
    { href: `/app/pro/${businessId}/references/numbering`, label: 'Numbering', desc: 'Paramètres de numérotation' },
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
                <p className="text-xs text-[var(--text-secondary)]">{link.desc}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={link.href}>Ouvrir</Link>
              </Button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">API à venir.</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
