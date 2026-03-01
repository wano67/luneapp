'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { KebabMenu } from '@/components/pro/projects/workspace-ui';
import type { ServiceItem } from './service-types';
import { SERVICE_UNIT_LABELS } from './service-types';

function formatMoney(cents: string | null) {
  if (!cents) return '—';
  const num = Number(cents);
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num / 100);
  } catch {
    return `${(num / 100).toFixed(0)} €`;
  }
}

function formatHours(value: number | null) {
  if (value == null) return '—';
  return `${value} h`;
}

type Props = {
  services: ServiceItem[];
  isAdmin: boolean;
  onEdit: (service: ServiceItem) => void;
  onDelete: (service: ServiceItem) => void;
  onTemplates: (service: ServiceItem) => void;
  onCreateFirst: () => void;
};

export function ServicesTable({ services, isAdmin, onEdit, onDelete, onTemplates, onCreateFirst }: Props) {
  if (services.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 border-dashed border-[var(--border)] bg-transparent p-4">
        <p className="text-sm text-[var(--text-faint)]">
          Crée ton premier service pour le vendre dans tes projets.
        </p>
        <Button onClick={onCreateFirst} disabled={!isAdmin}>
          Créer un service
        </Button>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead className="hidden md:table-cell">Catégorie</TableHead>
          <TableHead>Prix HT</TableHead>
          <TableHead className="hidden md:table-cell">Unité</TableHead>
          <TableHead className="hidden lg:table-cell">Durée</TableHead>
          <TableHead className="hidden lg:table-cell">Templates</TableHead>
          <TableHead className="w-10 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((service) => (
          <TableRow key={service.id}>
            <TableCell>
              <div className="space-y-0.5">
                <p className="font-semibold text-[var(--text-primary)]">{service.name}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[11px] text-[var(--text-faint)]">{service.code}</span>
                  {service.tagReferences?.map((tag) => (
                    <Badge key={tag.id} variant="neutral" className="text-[10px]">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {service.categoryReferenceName ? (
                <Badge variant="neutral">{service.categoryReferenceName}</Badge>
              ) : (
                <span className="text-[var(--text-faint)]">—</span>
              )}
            </TableCell>
            <TableCell>{formatMoney(service.defaultPriceCents)}</TableCell>
            <TableCell className="hidden md:table-cell">
              {SERVICE_UNIT_LABELS[service.unit] ?? service.unit}
            </TableCell>
            <TableCell className="hidden lg:table-cell">{formatHours(service.durationHours)}</TableCell>
            <TableCell className="hidden lg:table-cell">
              <button
                type="button"
                className="cursor-pointer text-sm text-[var(--accent)] hover:underline"
                onClick={() => onTemplates(service)}
              >
                {service.templateCount ?? 0}
              </button>
            </TableCell>
            <TableCell className="text-right">
              <KebabMenu
                ariaLabel={`Actions ${service.name}`}
                items={[
                  { label: 'Éditer', onClick: () => onEdit(service), disabled: !isAdmin },
                  { label: 'Templates', onClick: () => onTemplates(service) },
                  { label: 'Supprimer', onClick: () => onDelete(service), disabled: !isAdmin },
                ]}
              />
            </TableCell>
          </TableRow>
        ))}
        {services.length === 0 ? <TableEmpty>Aucun service.</TableEmpty> : null}
      </TableBody>
    </Table>
  );
}
