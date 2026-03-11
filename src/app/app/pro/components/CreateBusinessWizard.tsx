import { useMemo, useState, type FormEvent } from 'react';
import { Building2, Briefcase, Receipt, FileText, Check, ChevronRight, Info } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { COUNTRIES, CURRENCIES } from '@/lib/constants/geo';
import { isValidSiret, isValidVat } from '@/lib/validation/siret';
import {
  LEGAL_FORM_CONFIGS,
  getLegalFormConfig,
  ACTIVITY_TYPE_LABELS,
  SOCIAL_REGIME_LABELS,
  MICRO,
  type LegalFormConfig,
} from '@/config/taxation';

/* ═══ Draft type ═══ */

export type CreateBusinessDraft = {
  // Step 1 — Identité
  name: string;
  countryCode: string;
  legalForm: string;
  // Step 2 — Activité
  activityType: string; // SERVICE | COMMERCE | MIXTE | LIBERALE (uppercase)
  websiteUrl: string;
  currency: string;
  // Step 3 — Fiscalité (auto-déduit, reviewable)
  taxRegime: string;
  vatEnabled: boolean;
  vatRate: string;
  // Step 4 — Identification légale (skippable)
  legalName: string;
  siret: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  capital: string;
  nafCode: string;
  nafLabel: string;
  invoicePrefix: string;
  quotePrefix: string;
};

export const defaultDraft: CreateBusinessDraft = {
  name: '',
  countryCode: 'FR',
  legalForm: '',
  activityType: 'SERVICE',
  websiteUrl: '',
  currency: 'EUR',
  taxRegime: '',
  vatEnabled: true,
  vatRate: '20',
  legalName: '',
  siret: '',
  vatNumber: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  capital: '',
  nafCode: '',
  nafLabel: '',
  invoicePrefix: 'INV-',
  quotePrefix: 'DEV-',
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

/* ═══ Steps ═══ */

const STEPS = [
  { key: 'identite', label: 'Identite', icon: Building2 },
  { key: 'activite', label: 'Activite', icon: Briefcase },
  { key: 'fiscalite', label: 'Fiscalite', icon: Receipt },
  { key: 'legal', label: 'Identification', icon: FileText },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/* ═══ Helpers ═══ */

function getMicroCotisationRate(activityType: string): string {
  switch (activityType) {
    case 'COMMERCE': return `${(MICRO.COTISATIONS.VENTE * 100).toFixed(1)}%`;
    case 'SERVICE': return `${(MICRO.COTISATIONS.SERVICES_BIC * 100).toFixed(1)}%`;
    case 'LIBERALE': return `${(MICRO.COTISATIONS.BNC * 100).toFixed(1)}%`;
    case 'MIXTE': return `${(MICRO.COTISATIONS.SERVICES_BIC * 100).toFixed(1)}%`;
    default: return `${(MICRO.COTISATIONS.SERVICES_BIC * 100).toFixed(1)}%`;
  }
}

function computeProfileComplete(draft: CreateBusinessDraft, cfg: LegalFormConfig | undefined): boolean {
  if (!draft.legalName.trim()) return false;
  if (draft.countryCode === 'FR' && !draft.siret.trim()) return false;
  if (!draft.addressLine1.trim() || !draft.postalCode.trim() || !draft.city.trim()) return false;
  if (cfg?.requiresCapital && !draft.capital.trim()) return false;
  return true;
}

/* ═══ Wizard ═══ */

export function CreateBusinessWizard({ open, loading, error, draft, onChangeDraft, onClose, onSubmit }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex].key;

  const cfg = useMemo(() => (draft.legalForm ? getLegalFormConfig(draft.legalForm) : undefined), [draft.legalForm]);

  // Validation per step
  const canContinueStep1 = draft.name.trim().length >= 2 && !!draft.countryCode && !!draft.legalForm;
  const canContinueStep2 = !!draft.activityType;

  const siretError = draft.siret ? (isValidSiret(draft.siret) ? null : 'SIRET invalide (14 chiffres + controle)') : null;
  const vatValidation = draft.vatNumber ? isValidVat(draft.vatNumber, draft.countryCode) : { ok: true };
  const vatError = draft.vatNumber && !vatValidation.ok ? 'Numero de TVA intracom invalide.' : null;
  const capitalError = (() => {
    if (!cfg?.requiresCapital || !draft.capital) return null;
    const cents = Math.round(parseFloat(draft.capital) * 100);
    if (isNaN(cents) || cents < 0) return 'Montant invalide';
    if (cfg.capitalMinimumCents > 0 && cents < cfg.capitalMinimumCents) {
      return `Capital minimum : ${(cfg.capitalMinimumCents / 100).toLocaleString('fr-FR')} \u20ac`;
    }
    return null;
  })();

  const profileComplete = computeProfileComplete(draft, cfg);

  function goNext() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  // Auto-configure fiscal step when legalForm changes
  function handleLegalFormChange(code: string) {
    const formCfg = getLegalFormConfig(code);
    const isMicro = code === 'MICRO';
    onChangeDraft({
      ...draft,
      legalForm: code,
      taxRegime: formCfg?.defaultTaxRegime ?? '',
      vatEnabled: isMicro ? false : draft.vatEnabled,
      vatRate: isMicro ? '0' : draft.vatRate || '20',
    });
  }

  return (
    <Modal
      open={open}
      onCloseAction={() => (loading ? null : onClose())}
      title="Creer une entreprise"
      description={`Etape ${stepIndex + 1} sur ${STEPS.length}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step !== 'legal') {
            goNext();
            return;
          }
          onSubmit(e);
        }}
        className="space-y-4"
      >
        {/* ── Step indicator ── */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === stepIndex;
            const isDone = i < stepIndex;
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-[var(--text-faint)]" />}
                <button
                  type="button"
                  onClick={() => { if (isDone) setStepIndex(i); }}
                  disabled={!isDone}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition ${
                    isActive
                      ? 'bg-[var(--shell-accent)]/10 font-semibold text-[var(--shell-accent)]'
                      : isDone
                        ? 'cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        : 'text-[var(--text-faint)]'
                  }`}
                >
                  {isDone ? <Check size={12} /> : <Icon size={12} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Identité ── */}
        {step === 'identite' && (
          <div className="space-y-3">
            <Input
              label="Nom de l'entreprise *"
              value={draft.name}
              onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
              placeholder="Ex: Mon Entreprise"
              required
            />
            <SearchSelect
              label="Pays *"
              value={draft.countryCode}
              onChange={(code) => onChangeDraft({ ...draft, countryCode: code })}
              items={COUNTRIES.map((c) => ({ code: c.code, label: c.name }))}
              placeholder="Rechercher un pays..."
            />
            <Select
              label="Forme juridique *"
              value={draft.legalForm}
              onChange={(e) => handleLegalFormChange(e.target.value)}
            >
              <option value="">Selectionnez une forme juridique</option>
              {LEGAL_FORM_CONFIGS.map((f) => (
                <option key={f.code} value={f.code}>{f.label}</option>
              ))}
            </Select>

            {cfg && (
              <LegalFormInfoCard cfg={cfg} />
            )}
          </div>
        )}

        {/* ── Step 2: Activité ── */}
        {step === 'activite' && (
          <div className="space-y-3">
            <Select
              label="Type d'activite *"
              value={draft.activityType}
              onChange={(e) => onChangeDraft({ ...draft, activityType: e.target.value })}
            >
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>

            {cfg?.code === 'MICRO' && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg,var(--surface))]/50 p-3">
                <Info size={14} className="mt-0.5 shrink-0 text-[var(--shell-accent)]" />
                <div className="text-xs text-[var(--text-secondary)]">
                  <p className="font-medium text-[var(--text-primary)]">Cotisations micro-entrepreneur</p>
                  <p>
                    Taux de cotisations sociales pour votre activite :{' '}
                    <span className="font-semibold text-[var(--text-primary)]">{getMicroCotisationRate(draft.activityType)}</span>
                    {' '}du chiffre d&apos;affaires
                  </p>
                </div>
              </div>
            )}

            <Input
              label="Site web"
              value={draft.websiteUrl}
              onChange={(e) => onChangeDraft({ ...draft, websiteUrl: e.target.value })}
              placeholder="https://exemple.com"
            />
            <SearchSelect
              label="Devise"
              value={draft.currency}
              onChange={(code) => onChangeDraft({ ...draft, currency: code })}
              items={CURRENCIES.map((c) => ({ code: c.code, label: `${c.code} — ${c.name}` }))}
              placeholder="Rechercher une devise..."
            />
          </div>
        )}

        {/* ── Step 3: Fiscalité (auto-configured, reviewable) ── */}
        {step === 'fiscalite' && cfg && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-4 space-y-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Configuration fiscale</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Deduite automatiquement de la forme juridique <span className="font-medium text-[var(--text-primary)]">{cfg.label}</span>.
              </p>

              {/* Régime fiscal */}
              {cfg.allowedTaxRegimes.length > 1 ? (
                <Select
                  label="Regime fiscal"
                  value={draft.taxRegime}
                  onChange={(e) => onChangeDraft({ ...draft, taxRegime: e.target.value })}
                >
                  {cfg.allowedTaxRegimes.map((r) => (
                    <option key={r} value={r}>{r === 'IS' ? 'Impot sur les societes (IS)' : 'Impot sur le revenu (IR)'}</option>
                  ))}
                </Select>
              ) : (
                <ConfigRow label="Regime fiscal" value={draft.taxRegime === 'IS' ? 'Impot sur les societes (IS)' : 'Impot sur le revenu (IR)'} />
              )}

              {/* Régime social */}
              <ConfigRow label="Regime social" value={SOCIAL_REGIME_LABELS[cfg.defaultSocialRegime]} />

              {/* Dirigeant */}
              <ConfigRow label="Titre du dirigeant" value={cfg.leaderTitle} />
            </div>

            {/* TVA */}
            {cfg.code === 'MICRO' ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <Info size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="text-xs text-[var(--text-secondary)]">
                  <p className="font-medium text-[var(--text-primary)]">Franchise en base de TVA</p>
                  <p>
                    En micro-entreprise, la TVA n&apos;est pas applicable (art. 293 B du CGI).
                    Cette mention sera ajoutee automatiquement sur vos devis et factures.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--text-primary)]">TVA activee</label>
                  <button
                    type="button"
                    onClick={() => onChangeDraft({ ...draft, vatEnabled: !draft.vatEnabled })}
                    className={`relative h-6 w-11 rounded-full transition-colors ${draft.vatEnabled ? 'bg-[var(--shell-accent)]' : 'bg-[var(--border)]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow ${draft.vatEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                {draft.vatEnabled && (
                  <Input
                    label="Taux TVA (%)"
                    type="number"
                    value={draft.vatRate}
                    onChange={(e) => onChangeDraft({ ...draft, vatRate: e.target.value })}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Identification légale (skippable) ── */}
        {step === 'legal' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3">
              <Info size={14} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />
              <p className="text-xs text-[var(--text-secondary)]">
                Ces informations sont necessaires pour generer des documents conformes (devis, factures).
                Vous pouvez les completer plus tard dans les parametres.
              </p>
            </div>

            <Input
              label="Raison sociale / Denomination"
              value={draft.legalName}
              onChange={(e) => onChangeDraft({ ...draft, legalName: e.target.value })}
              placeholder="Denomination legale complete"
            />
            <Input
              label="SIRET (France)"
              value={draft.siret}
              onChange={(e) => onChangeDraft({ ...draft, siret: e.target.value })}
              helper="14 chiffres, controle Luhn"
              error={siretError ?? undefined}
            />
            {draft.vatEnabled && (
              <Input
                label="N\u00b0 TVA intracommunautaire"
                value={draft.vatNumber}
                onChange={(e) => onChangeDraft({ ...draft, vatNumber: e.target.value })}
                helper="Ex: FRXX999999999"
                error={vatError ?? undefined}
              />
            )}
            <Input
              label="Adresse"
              value={draft.addressLine1}
              onChange={(e) => onChangeDraft({ ...draft, addressLine1: e.target.value })}
              placeholder="Numero et rue"
            />
            <Input
              label="Complement d'adresse"
              value={draft.addressLine2}
              onChange={(e) => onChangeDraft({ ...draft, addressLine2: e.target.value })}
              placeholder="Batiment, etage..."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                label="Code postal"
                value={draft.postalCode}
                onChange={(e) => onChangeDraft({ ...draft, postalCode: e.target.value })}
              />
              <Input
                label="Ville"
                value={draft.city}
                onChange={(e) => onChangeDraft({ ...draft, city: e.target.value })}
              />
            </div>

            {cfg?.requiresCapital && (
              <Input
                label={`Capital social (\u20ac)${cfg.capitalMinimumCents > 0 ? ` — min ${(cfg.capitalMinimumCents / 100).toLocaleString('fr-FR')} \u20ac` : ''}`}
                type="number"
                value={draft.capital}
                onChange={(e) => onChangeDraft({ ...draft, capital: e.target.value })}
                placeholder="Ex: 1000"
                error={capitalError ?? undefined}
              />
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                label="Code NAF"
                value={draft.nafCode}
                onChange={(e) => onChangeDraft({ ...draft, nafCode: e.target.value })}
                placeholder="Ex: 62.01Z"
              />
              <Input
                label="Libelle NAF"
                value={draft.nafLabel}
                onChange={(e) => onChangeDraft({ ...draft, nafLabel: e.target.value })}
                placeholder="Ex: Programmation informatique"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                label="Prefixe factures"
                value={draft.invoicePrefix}
                onChange={(e) => onChangeDraft({ ...draft, invoicePrefix: e.target.value })}
              />
              <Input
                label="Prefixe devis"
                value={draft.quotePrefix}
                onChange={(e) => onChangeDraft({ ...draft, quotePrefix: e.target.value })}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (loading) return;
              if (stepIndex === 0) onClose();
              else goBack();
            }}
          >
            {stepIndex === 0 ? 'Annuler' : 'Retour'}
          </Button>

          <div className="flex items-center gap-2">
            {step === 'legal' && !profileComplete && (
              <Button
                variant="outline"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creation...' : 'Completer plus tard'}
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                loading ||
                (step === 'identite' && !canContinueStep1) ||
                (step === 'activite' && !canContinueStep2) ||
                (step === 'legal' && (!!siretError || !!vatError || !!capitalError))
              }
            >
              {step === 'legal'
                ? loading ? 'Creation...' : 'Creer l\u2019entreprise'
                : 'Continuer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ═══ Sub-components ═══ */

function LegalFormInfoCard({ cfg }: { cfg: LegalFormConfig }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3 space-y-1">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{cfg.label}</p>
      <p className="text-xs text-[var(--text-secondary)]">{cfg.description}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs text-[var(--text-secondary)]">
        <span>Regime : <b className="text-[var(--text-primary)]">{cfg.defaultTaxRegime}</b></span>
        <span>Social : <b className="text-[var(--text-primary)]">{SOCIAL_REGIME_LABELS[cfg.defaultSocialRegime]}</b></span>
        <span>Dirigeant : <b className="text-[var(--text-primary)]">{cfg.leaderTitle}</b></span>
        <span>
          {cfg.maxAssocies === 1
            ? '1 associe'
            : cfg.maxAssocies
              ? `${cfg.minAssocies}-${cfg.maxAssocies} associes`
              : `${cfg.minAssocies}+ associes`}
        </span>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
