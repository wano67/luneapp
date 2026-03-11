'use client';

import { useState } from 'react';
import { Modal, ModalFooterSticky } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';

type Goal = {
  id: string;
  name: string;
  targetCents: number;
  metric: string;
  year: number;
};

type Props = {
  open: boolean;
  businessId: string;
  goal?: Goal | null;
  onCloseAction: () => void;
  onSaved: () => void;
};

const METRICS = [
  { value: 'CA_HT', label: 'Chiffre d\'affaires HT' },
  { value: 'RESULTAT_NET', label: 'Resultat net' },
  { value: 'REVENU_NET_DIRIGEANT', label: 'Revenu net dirigeant' },
  { value: 'MARGE_BRUTE', label: 'Marge brute' },
];

export function GoalFormModal({ open, businessId, goal, onCloseAction, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!goal;
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(goal?.name ?? '');
  const [metric, setMetric] = useState(goal?.metric ?? 'CA_HT');
  const [target, setTarget] = useState(goal ? String(goal.targetCents / 100) : '');
  const [year, setYear] = useState(String(goal?.year ?? currentYear));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !Number(target)) return;

    setSaving(true);
    const payload = isEdit
      ? { name: name.trim(), targetCents: Math.round(Number(target) * 100) }
      : { name: name.trim(), metric, targetCents: Math.round(Number(target) * 100), year: Number(year) };

    const url = isEdit
      ? `/api/pro/businesses/${businessId}/goals/${goal.id}`
      : `/api/pro/businesses/${businessId}/goals`;
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetchJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      toast.success(isEdit ? 'Objectif mis a jour.' : 'Objectif cree.');
      onSaved();
      onCloseAction();
    } else {
      toast.error(res.error ?? 'Erreur lors de la sauvegarde.');
    }
  }

  return (
    <Modal
      open={open}
      onCloseAction={onCloseAction}
      title={isEdit ? 'Modifier l\'objectif' : 'Ajouter un objectif'}
      description="Definissez un objectif financier pour votre entreprise."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nom de l'objectif" value={name} onChange={(e) => setName(e.target.value)} required />

        {!isEdit && (
          <Select label="Metrique" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        )}

        <Input
          label="Objectif (EUR)"
          type="number"
          min="0"
          step="0.01"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          required
        />

        {!isEdit && (
          <Select label="Annee" value={year} onChange={(e) => setYear(e.target.value)}>
            {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        )}

        <ModalFooterSticky>
          <Button type="button" variant="ghost" onClick={onCloseAction}>Annuler</Button>
          <Button type="submit" disabled={saving || !name.trim() || !Number(target)}>
            {saving ? 'Enregistrement...' : isEdit ? 'Mettre a jour' : 'Ajouter'}
          </Button>
        </ModalFooterSticky>
      </form>
    </Modal>
  );
}
