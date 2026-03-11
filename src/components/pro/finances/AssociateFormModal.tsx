'use client';

import { useState } from 'react';
import { Modal, ModalFooterSticky } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';

type Associate = {
  id: string;
  name: string;
  role: string;
  isLeader: boolean;
  sharePercent: number;
  grossSalaryYearlyCents: number;
  dividendsCents: number;
  ccaCents: number;
  nbParts: number;
};

type Props = {
  open: boolean;
  businessId: string;
  associate?: Associate | null;
  onCloseAction: () => void;
  onSaved: () => void;
};

const ROLES = [
  { value: 'PRESIDENT', label: 'President' },
  { value: 'DIRECTEUR_GENERAL', label: 'Directeur general' },
  { value: 'GERANT_MAJORITAIRE', label: 'Gerant majoritaire' },
  { value: 'GERANT_MINORITAIRE', label: 'Gerant minoritaire' },
  { value: 'ASSOCIE', label: 'Associe' },
];

export function AssociateFormModal({ open, businessId, associate, onCloseAction, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!associate;

  const [name, setName] = useState(associate?.name ?? '');
  const [role, setRole] = useState(associate?.role ?? 'PRESIDENT');
  const [isLeader, setIsLeader] = useState(associate?.isLeader ?? true);
  const [sharePercent, setSharePercent] = useState(String(associate?.sharePercent ?? ''));
  const [grossSalary, setGrossSalary] = useState(associate ? String(associate.grossSalaryYearlyCents / 100) : '');
  const [dividends, setDividends] = useState(associate ? String(associate.dividendsCents / 100) : '');
  const [cca, setCca] = useState(associate ? String(associate.ccaCents / 100) : '');
  const [nbParts, setNbParts] = useState(String(associate?.nbParts ?? 1));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    const payload = {
      name: name.trim(),
      role,
      isLeader,
      sharePercent: Number(sharePercent) || 0,
      grossSalaryYearlyCents: Math.round((Number(grossSalary) || 0) * 100),
      dividendsCents: Math.round((Number(dividends) || 0) * 100),
      ccaCents: Math.round((Number(cca) || 0) * 100),
      nbParts: Math.max(1, Math.round(Number(nbParts) || 1)),
    };

    const url = isEdit
      ? `/api/pro/businesses/${businessId}/associates/${associate.id}`
      : `/api/pro/businesses/${businessId}/associates`;
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetchJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      toast.success(isEdit ? 'Associe mis a jour.' : 'Associe ajoute.');
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
      title={isEdit ? 'Modifier l\'associe' : 'Ajouter un associe'}
      description="Renseignez les informations de l'associe ou dirigeant."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />

        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={isLeader}
            onChange={(e) => setIsLeader(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--shell-accent)]"
          />
          Dirigeant de l&apos;entreprise
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Parts sociales (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={sharePercent}
            onChange={(e) => setSharePercent(e.target.value)}
          />
          <Input
            label="Parts fiscales IR"
            type="number"
            min="1"
            step="1"
            value={nbParts}
            onChange={(e) => setNbParts(e.target.value)}
          />
        </div>

        <Input
          label="Salaire brut annuel (EUR)"
          type="number"
          min="0"
          step="0.01"
          value={grossSalary}
          onChange={(e) => setGrossSalary(e.target.value)}
          helper="Remuneration brute annuelle du dirigeant/associe."
        />

        <Input
          label="Dividendes annuels (EUR)"
          type="number"
          min="0"
          step="0.01"
          value={dividends}
          onChange={(e) => setDividends(e.target.value)}
          helper="Dividendes verses sur l'exercice."
        />

        <Input
          label="Compte courant d'associe (EUR)"
          type="number"
          min="0"
          step="0.01"
          value={cca}
          onChange={(e) => setCca(e.target.value)}
          helper="Solde du CCA (utilise pour le calcul du seuil 10% SARL)."
        />

        <ModalFooterSticky>
          <Button type="button" variant="ghost" onClick={onCloseAction}>Annuler</Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Enregistrement...' : isEdit ? 'Mettre a jour' : 'Ajouter'}
          </Button>
        </ModalFooterSticky>
      </form>
    </Modal>
  );
}
