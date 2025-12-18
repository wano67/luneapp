// src/app/app/pro/[businessId]/settings/taxes/page.tsx
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { defaultTaxSettings, formatDate, type TaxSettings } from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

export default function BusinessTaxesSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const [stored, setStored] = usePersistentState<TaxSettings>(
    `taxes:${businessId}`,
    defaultTaxSettings
  );
  const [form, setForm] = useState<TaxSettings>(stored);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setForm(stored);
  }, [stored]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!form.vatNumber.trim()) issues.push('Numéro TVA requis');
    if (form.vatRate <= 0) issues.push('Taux TVA invalide');
    if (!form.country.trim()) issues.push('Pays requis');
    return issues;
  }, [form]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    if (validation.length) {
      setError(validation[0]);
      return;
    }
    const next: TaxSettings = {
      ...form,
      updatedAt: new Date().toISOString(),
      updatedBy: 'toi',
    };
    setStored(next);
    setSaved('Paramètres TVA sauvegardés.');
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Taxes
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Taxes & TVA</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Configurer la TVA (taux, période) et les obligations fiscales de Business #{businessId}.
        </p>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Taux TVA (%)"
              placeholder="20"
              type="number"
              value={form.vatRate}
              onChange={(e) => setForm((prev) => ({ ...prev, vatRate: Number(e.target.value) }))}
            />
            <Select
              label="Période TVA"
              value={form.vatPeriod}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vatPeriod: e.target.value as TaxSettings['vatPeriod'] }))
              }
            >
              <option value="MONTHLY">Mensuelle</option>
              <option value="QUARTERLY">Trimestrielle</option>
            </Select>
            <Input
              label="Numéro TVA"
              placeholder="FRXX..."
              value={form.vatNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, vatNumber: e.target.value }))}
            />
            <Input
              label="Pays"
              placeholder="France"
              value={form.country}
              onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
            />
            <Input
              label="Dernière déclaration"
              type="date"
              value={form.lastFiledAt ? form.lastFiledAt.slice(0, 10) : ''}
              onChange={(e) => {
                const nextValue = e.target.value ? new Date(e.target.value).toISOString() : null;
                setForm((prev) => ({ ...prev, lastFiledAt: nextValue }));
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <div className="space-y-1">
              <p>Audit : {formatDate(form.updatedAt)} · {form.updatedBy}</p>
              <p>Business #{businessId}</p>
            </div>
            {error ? <span className="text-rose-500">{error}</span> : null}
            {saved ? <span className="text-emerald-500">{saved}</span> : null}
          </div>

          <div className="flex items-center justify-between">
            {validation.length ? (
              <Badge variant="neutral" className="bg-amber-200/40 text-amber-700">
                {validation[0]}
              </Badge>
            ) : (
              <Badge variant="neutral" className="bg-emerald-200/40 text-emerald-700">
                OK
              </Badge>
            )}
            <Button type="submit">Enregistrer</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
