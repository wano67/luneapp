import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchSelect } from '@/components/ui/search-select';
import { OptionCard } from '@/components/ui/option-card';
import { COUNTRIES, CURRENCIES } from '@/lib/constants/geo';
import { isValidSiret, isValidVat } from '@/lib/validation/siret';

export type CreateBusinessDraft = {
  name: string;
  activityType: 'service' | 'product' | 'mixte';
  countryCode: string;
  websiteUrl: string;
  sector?: string;
  size?: string;
  goal?: string;
  currency: string;
  vatEnabled: boolean;
  vatRate: string;
  invoicePrefix: string;
  quotePrefix: string;
  importNow: boolean;
  createDemo: boolean;
  legalName?: string;
  siret?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
};

const defaultDraft: CreateBusinessDraft = {
  name: '',
  activityType: 'service',
  countryCode: 'FR',
  websiteUrl: '',
  sector: 'service',
  size: 'solo',
  goal: 'services',
  currency: 'EUR',
  vatEnabled: true,
  vatRate: '20',
  invoicePrefix: 'INV-',
  quotePrefix: 'DEV-',
  importNow: false,
  createDemo: false,
};

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  draft: CreateBusinessDraft;
  onChangeDraft: (draft: CreateBusinessDraft) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export function CreateBusinessWizard({ open, loading, error, draft, onChangeDraft, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  const canContinue = useMemo(() => {
    return draft.name.trim().length >= 2 && !!draft.countryCode;
  }, [draft.name, draft.countryCode]);

  const siretError = draft.siret ? (isValidSiret(draft.siret) ? null : 'SIRET invalide (14 chiffres + contrôle)') : null;
  const vatValidation = draft.vatNumber ? isValidVat(draft.vatNumber, draft.countryCode) : { ok: true };
  const vatError = draft.vatNumber && !vatValidation.ok ? 'Numéro de TVA intracom invalide.' : null;

  return (
    <Modal
      open={open}
      onCloseAction={() => (loading ? null : onClose())}
      title="Créer une entreprise"
      description="2 étapes rapides pour configurer votre espace."
    >
      <form
        onSubmit={(e) => {
          if (step === 1) {
            e.preventDefault();
            if (canContinue) setStep(2);
            return;
          }
          onSubmit(e);
        }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className={step === 1 ? 'font-semibold text-[var(--text-primary)]' : ''}>Étape 1</span>
          <span className="text-[var(--text-secondary)]">→</span>
          <span className={step === 2 ? 'font-semibold text-[var(--text-primary)]' : ''}>Étape 2</span>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <Input
              label="Nom de l’entreprise *"
              value={draft.name}
              onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
              error={error ?? undefined}
              placeholder="Ex: StudioFief"
              required
            />
            <SearchSelect
              label="Pays *"
              value={draft.countryCode}
              onChange={(code) => onChangeDraft({ ...draft, countryCode: code })}
              items={COUNTRIES.map((c) => ({ code: c.code, label: c.name }))}
              placeholder="Rechercher un pays…"
              helper="Sélectionne un pays (ISO-2)."
            />
            <Input
              label="Site web"
              value={draft.websiteUrl}
              onChange={(e) => onChangeDraft({ ...draft, websiteUrl: e.target.value })}
              placeholder="https://exemple.com"
            />
            <label className="space-y-1 text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Secteur / activité</span>
              <select
                value={draft.sector}
                onChange={(e) => onChangeDraft({ ...draft, sector: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <option value="service">Services</option>
                <option value="product">Produits</option>
                <option value="commerce">Commerce</option>
                <option value="agency">Agence</option>
                <option value="freelance">Freelance</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Taille</span>
              <select
                value={draft.size}
                onChange={(e) => onChangeDraft({ ...draft, size: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <option value="solo">Solo</option>
                <option value="2-5">2-5</option>
                <option value="6-20">6-20</option>
                <option value="20+">20+</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Objectif principal</span>
              <select
                value={draft.goal}
                onChange={(e) => onChangeDraft({ ...draft, goal: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <option value="services">Vendre des services</option>
                <option value="products">Vendre des produits</option>
                <option value="projects">Gérer des projets clients</option>
                <option value="finance">Suivre les finances</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <SearchSelect
              label="Devise"
              value={draft.currency}
              onChange={(code) => onChangeDraft({ ...draft, currency: code })}
              items={CURRENCIES.map((c) => ({ code: c.code, label: `${c.code} — ${c.name}` }))}
              placeholder="Rechercher une devise…"
            />
            <OptionCard
              title="TVA activée"
              description="Appliquer la TVA sur factures."
              checked={draft.vatEnabled}
              onChange={(next) => onChangeDraft({ ...draft, vatEnabled: next })}
            />
            {draft.vatEnabled ? (
              <Input
                label="Taux TVA (%)"
                type="number"
                value={draft.vatRate}
                onChange={(e) => onChangeDraft({ ...draft, vatRate: e.target.value })}
              />
            ) : null}
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Identification légale</p>
              <Input
                label="Raison sociale"
                value={draft.legalName ?? ''}
                onChange={(e) => onChangeDraft({ ...draft, legalName: e.target.value })}
                placeholder="Nom légal complet"
              />
              <Input
              label="SIRET (France)"
              value={draft.siret ?? ''}
              onChange={(e) => onChangeDraft({ ...draft, siret: e.target.value })}
              helper="14 chiffres, contrôle Luhn"
              error={siretError ?? undefined}
            />
            <Input
              label="TVA intracom"
              value={draft.vatNumber ?? ''}
              onChange={(e) => onChangeDraft({ ...draft, vatNumber: e.target.value })}
              helper="Ex: FRXX999999999"
              error={vatError ?? undefined}
            />
              <Input
                label="Adresse ligne 1"
                value={draft.addressLine1 ?? ''}
                onChange={(e) => onChangeDraft({ ...draft, addressLine1: e.target.value })}
              />
              <Input
                label="Adresse ligne 2"
                value={draft.addressLine2 ?? ''}
                onChange={(e) => onChangeDraft({ ...draft, addressLine2: e.target.value })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Code postal"
                  value={draft.postalCode ?? ''}
                  onChange={(e) => onChangeDraft({ ...draft, postalCode: e.target.value })}
                />
                <Input
                  label="Ville"
                  value={draft.city ?? ''}
                  onChange={(e) => onChangeDraft({ ...draft, city: e.target.value })}
                />
              </div>
            </div>
            <Input
              label="Préfixe factures"
              value={draft.invoicePrefix}
              onChange={(e) => onChangeDraft({ ...draft, invoicePrefix: e.target.value })}
            />
            <Input
              label="Préfixe devis"
              value={draft.quotePrefix}
              onChange={(e) => onChangeDraft({ ...draft, quotePrefix: e.target.value })}
            />
            <OptionCard
              title="Importer des données maintenant"
              description="Import CSV dès la création."
              checked={draft.importNow}
              onChange={(next) => onChangeDraft({ ...draft, importNow: next })}
            />
            <OptionCard
              title="Créer des éléments de démo"
              description="Remplir l’espace avec des exemples."
              checked={draft.createDemo}
              onChange={(next) => onChangeDraft({ ...draft, createDemo: next })}
            />
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">Résumé</p>
              <p>{draft.name} · {draft.countryCode} · {draft.currency}</p>
              <p>TVA: {draft.vatEnabled ? `${draft.vatRate}%` : 'désactivée'}</p>
              <p>Objectif: {draft.goal}</p>
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (loading) return;
              if (step === 1) onClose();
              else setStep(1);
            }}
          >
            {step === 1 ? 'Annuler' : 'Retour'}
          </Button>
          <Button type="submit" disabled={loading || (step === 1 && !canContinue)}>
            {step === 1 ? 'Continuer' : loading ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { defaultDraft };
