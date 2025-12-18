// src/app/app/pro/[businessId]/settings/billing/page.tsx
'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  defaultBillingSettings,
  formatDate,
  type BillingSettings,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

export default function BusinessBillingSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const [stored, setStored] = usePersistentState<BillingSettings>(
    `billing:${businessId}`,
    defaultBillingSettings
  );

  const [form, setForm] = useState<BillingSettings>(stored);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setForm(stored);
  }, [stored]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!form.legalName.trim()) issues.push('Raison sociale requise');
    if (!form.currency.trim() || form.currency.trim().length !== 3) {
      issues.push('Devise sur 3 lettres (EUR, USD…)');
    }
    if (!Number.isFinite(form.invoiceNextNumber) || form.invoiceNextNumber <= 0) {
      issues.push('Prochain numéro invalide');
    }
    if (!form.invoicePrefix.trim()) issues.push('Préfixe requis');
    if (!form.address.trim()) issues.push('Adresse requise');
    return issues;
  }, [form]);

  function handleChange<K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNumber(key: keyof BillingSettings, e: ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    if (Number.isNaN(val)) {
      setForm((prev) => ({ ...prev, [key]: 0 } as BillingSettings));
    } else {
      setForm((prev) => ({ ...prev, [key]: val } as BillingSettings));
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    if (validation.length) {
      setError(validation[0]);
      return;
    }
    const next: BillingSettings = {
      ...form,
      updatedAt: new Date().toISOString(),
      updatedBy: 'toi',
    };
    setStored(next);
    setSaved('Préférences enregistrées localement.');
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Settings · Billing
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Facturation</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Coordonnées de facturation, devise et préférences d’émission pour Business #{businessId}.
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Raison sociale"
              placeholder="Ex: StudioFief SAS"
              value={form.legalName}
              onChange={(e) => handleChange('legalName', e.target.value)}
            />
            <Input
              label="Adresse"
              placeholder="12 rue..."
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
            <Input
              label="Devise"
              placeholder="EUR"
              value={form.currency}
              onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
              maxLength={3}
            />
            <Input
              label="Fuseau horaire"
              placeholder="Europe/Paris"
              value={form.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
            />
            <Input
              label="Préfixe factures"
              placeholder="INV-"
              value={form.invoicePrefix}
              onChange={(e) => handleChange('invoicePrefix', e.target.value)}
            />
            <Input
              label="Prochain numéro"
              placeholder="1024"
              type="number"
              value={form.invoiceNextNumber}
              onChange={(e) => handleNumber('invoiceNextNumber', e)}
            />
            <Input
              label="IBAN (optionnel)"
              placeholder="FR76..."
              value={form.iban ?? ''}
              onChange={(e) => handleChange('iban', e.target.value)}
            />
            <Input
              label="Notes sur facture"
              placeholder="Règlement à 30 jours..."
              value={form.notes ?? ''}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <div className="space-y-1">
              <p>Audit trail : mis à jour {formatDate(form.updatedAt)} par {form.updatedBy}</p>
              <p>Business #{businessId}</p>
            </div>
            {error ? <span className="text-rose-500">{error}</span> : null}
            {saved ? <span className="text-emerald-500">{saved}</span> : null}
          </div>

          <div className="flex justify-end gap-2">
            {validation.length ? (
              <Badge variant="neutral" className="bg-amber-200/30 text-amber-700">
                {validation[0]}
              </Badge>
            ) : (
              <Badge variant="neutral" className="bg-emerald-200/30 text-emerald-700">
                Formulaire valide
              </Badge>
            )}
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
