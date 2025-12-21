'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const referenceLinks = [
  { href: 'categories', title: 'Catégories', desc: 'Classer clients, projets et finances.' },
  { href: 'tags', title: 'Tags', desc: 'Tags globaux pour organiser et filtrer.' },
  { href: 'numbering', title: 'Numérotation', desc: 'Préfixes et séquences pour documents.' },
  { href: 'automations', title: 'Automations', desc: 'Règles et SOPs centralisées.' },
];

export default function ReferencesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Référentiels</h1>
        <p className="text-muted-foreground">
          Gérez les catégories, tags, numérotations et automations partagées pour votre entreprise.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {referenceLinks.map((link) => (
          <Card key={link.href} className="p-4 flex flex-col gap-2 justify-between">
            <div>
              <h2 className="text-lg font-semibold">{link.title}</h2>
              <p className="text-sm text-muted-foreground">{link.desc}</p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/app/pro/${businessId}/references/${link.href}`}>Ouvrir</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/app/pro/${businessId}`}>Dashboard</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
