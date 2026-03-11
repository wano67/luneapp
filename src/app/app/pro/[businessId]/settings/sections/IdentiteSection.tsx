'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AddressInput } from '@/components/ui/AddressInput';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { LEGAL_FORM_CONFIGS, getLegalFormConfig, ACTIVITY_TYPE_LABELS, SOCIAL_REGIME_LABELS } from '@/config/taxation';

type BusinessResponse = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  legalName?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  legalForm?: string | null;
  taxRegime?: string | null;
  activityType?: string | null;
  nafCode?: string | null;
  nafLabel?: string | null;
  leaderTitle?: string | null;
  socialRegime?: string | null;
  capital?: number | null;
};

export function IdentiteSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const canEdit = role === 'ADMIN' || role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [legalName, setLegalName] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [legalForm, setLegalForm] = useState('');
  const [activityType, setActivityType] = useState('');
  const [nafCode, setNafCode] = useState('');
  const [nafLabel, setNafLabel] = useState('');
  const [leaderTitle, setLeaderTitle] = useState('');
  const [socialRegime, setSocialRegime] = useState('');
  const [capital, setCapital] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<BusinessResponse>(`/api/pro/businesses/${businessId}`);
      setLoading(false);
      if (!res.ok || !res.data) { setError(res.error ?? 'Impossible de charger.'); return; }
      setName(res.data.name ?? '');
      setWebsiteUrl(res.data.websiteUrl ?? '');
      setLegalName(res.data.legalName ?? '');
      setSiret(res.data.siret ?? '');
      setVatNumber(res.data.vatNumber ?? '');
      setAddressLine1(res.data.addressLine1 ?? '');
      setAddressLine2(res.data.addressLine2 ?? '');
      setPostalCode(res.data.postalCode ?? '');
      setCity(res.data.city ?? '');
      setCountryCode(res.data.countryCode ?? '');
      setLegalForm(res.data.legalForm ?? '');
      setActivityType(res.data.activityType ?? '');
      setNafCode(res.data.nafCode ?? '');
      setNafLabel(res.data.nafLabel ?? '');
      setLeaderTitle(res.data.leaderTitle ?? '');
      setSocialRegime(res.data.socialRegime ?? '');
      setCapital(res.data.capital ? String(res.data.capital / 100) : '');
    })();
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Nom requis.'); return; }
    setSaving(true); setError(null);

    const res = await fetchJson<{ item: BusinessResponse }>(`/api/pro/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({
        name: trimmedName,
        websiteUrl: websiteUrl.trim() || null,
        legalName: legalName.trim() || null,
        siret: siret.trim() || null,
        vatNumber: vatNumber.trim() || null,
        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        postalCode: postalCode.trim() || null,
        city: city.trim() || null,
        countryCode: countryCode.trim() || null,
        legalForm: legalForm || null,
        activityType: activityType || null,
        nafCode: nafCode.trim() || null,
        nafLabel: nafLabel.trim() || null,
        leaderTitle: leaderTitle.trim() || null,
        socialRegime: socialRegime || null,
        capital: capital ? Math.round(parseFloat(capital) * 100) : null,
      }),
    });

    setSaving(false);
    if (!res.ok || !res.data?.item) { setError(res.error ?? 'Mise a jour impossible.'); return; }
    const d = res.data.item;
    setName(d.name ?? ''); setWebsiteUrl(d.websiteUrl ?? ''); setLegalName(d.legalName ?? '');
    setSiret(d.siret ?? ''); setVatNumber(d.vatNumber ?? '');
    setAddressLine1(d.addressLine1 ?? ''); setAddressLine2(d.addressLine2 ?? '');
    setPostalCode(d.postalCode ?? ''); setCity(d.city ?? ''); setCountryCode(d.countryCode ?? '');
    setLegalForm(d.legalForm ?? ''); setActivityType(d.activityType ?? '');
    setNafCode(d.nafCode ?? ''); setNafLabel(d.nafLabel ?? '');
    setLeaderTitle(d.leaderTitle ?? ''); setSocialRegime(d.socialRegime ?? '');
    setCapital(d.capital ? String(d.capital / 100) : '');
    toast.celebrate({ title: 'Identité mise à jour !' });
  }

  const formConfig = legalForm ? getLegalFormConfig(legalForm) : undefined;
  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Identite</p>
        <p className="text-sm text-[var(--text-secondary)]">Nom, forme juridique, SIRET et adresse de l&apos;entreprise.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} required />
          <Input label="Raison sociale" value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={disabled} />
          <Select
            label="Forme juridique"
            value={legalForm}
            onChange={(e) => {
              const code = e.target.value;
              setLegalForm(code);
              const cfg = getLegalFormConfig(code);
              if (cfg) {
                setLeaderTitle(cfg.leaderTitle);
                setSocialRegime(cfg.defaultSocialRegime);
              }
            }}
            disabled={disabled}
          >
            <option value="">Non renseignee</option>
            {LEGAL_FORM_CONFIGS.map((f) => (
              <option key={f.code} value={f.code}>{f.label}</option>
            ))}
          </Select>
          <Select
            label="Type d'activite"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            disabled={disabled}
          >
            <option value="">Non renseigne</option>
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input label="Code NAF/APE" value={nafCode} onChange={(e) => setNafCode(e.target.value)} placeholder="62.01Z" disabled={disabled} />
          <Input label="Libelle NAF" value={nafLabel} onChange={(e) => setNafLabel(e.target.value)} placeholder="Programmation informatique" disabled={disabled} />
          <Input label="Titre du dirigeant" value={leaderTitle} onChange={(e) => setLeaderTitle(e.target.value)} placeholder={formConfig?.leaderTitle ?? 'President, Gerant...'} disabled={disabled} />
          <Input label="Site web" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://exemple.com" disabled={disabled} />
          <Input label="SIRET" value={siret} onChange={(e) => setSiret(e.target.value)} disabled={disabled} />
          <Input label="Numero TVA" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} disabled={disabled} />
          {formConfig?.requiresCapital && (
            <Input
              label={`Capital social (\u20ac)${formConfig.capitalMinimumCents > 0 ? ` — min ${(formConfig.capitalMinimumCents / 100).toLocaleString('fr-FR')} \u20ac` : ''}`}
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              placeholder="Ex: 1000"
              disabled={disabled}
            />
          )}
        </div>

        {formConfig && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3 text-xs text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">{formConfig.label}</p>
            <p>{formConfig.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium">Regime : {formConfig.defaultTaxRegime}</span>
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium">{SOCIAL_REGIME_LABELS[formConfig.defaultSocialRegime]}</span>
              {formConfig.maxAssocies === 1
                ? <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium">1 associe</span>
                : <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium">{formConfig.minAssocies}+ associes</span>
              }
            </div>
          </div>
        )}

        <AddressInput
          value={{ addressLine1, postalCode, city }}
          onChange={(f) => { if (f.addressLine1 !== undefined) setAddressLine1(f.addressLine1); if (f.postalCode !== undefined) setPostalCode(f.postalCode); if (f.city !== undefined) setCity(f.city); }}
          countryCode={countryCode || 'FR'}
          disabled={disabled}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Complement d'adresse" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} disabled={disabled} />
          <Input label="Pays (ISO)" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="FR" disabled={disabled} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Reserve aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
