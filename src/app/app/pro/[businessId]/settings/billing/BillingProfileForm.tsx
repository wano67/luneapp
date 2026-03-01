'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AddressInput } from '@/components/ui/AddressInput';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type BusinessProfile = {
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
  billingEmail?: string | null;
  billingPhone?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  billingLegalText?: string | null;
  role?: string | null;
};

type PatchResponse = {
  item: BusinessProfile;
};

type Props = {
  businessId: string;
};

export function BillingProfileForm({ businessId }: Props) {
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const canEdit = role === 'ADMIN' || role === 'OWNER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [legalName, setLegalName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [billingLegalText, setBillingLegalText] = useState('');

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function load() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await fetchJson<BusinessProfile>(`/api/pro/businesses/${businessId}`);
    setRequestId(res.requestId ?? null);
    setLoading(false);
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de charger le profil de facturation.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setLegalName(res.data.legalName ?? '');
    setWebsiteUrl(res.data.websiteUrl ?? '');
    setSiret(res.data.siret ?? '');
    setVatNumber(res.data.vatNumber ?? '');
    setAddressLine1(res.data.addressLine1 ?? '');
    setAddressLine2(res.data.addressLine2 ?? '');
    setPostalCode(res.data.postalCode ?? '');
    setCity(res.data.city ?? '');
    setCountryCode(res.data.countryCode ?? '');
    setBillingEmail(res.data.billingEmail ?? '');
    setBillingPhone(res.data.billingPhone ?? '');
    setIban(res.data.iban ?? '');
    setBic(res.data.bic ?? '');
    setBankName(res.data.bankName ?? '');
    setAccountHolder(res.data.accountHolder ?? '');
    setBillingLegalText(res.data.billingLegalText ?? '');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      setInfo('Réservé aux admins/owners.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);

    const payload: Record<string, unknown> = {
      legalName: legalName.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      siret: siret.trim() || null,
      vatNumber: vatNumber.trim() || null,
      addressLine1: addressLine1.trim() || null,
      addressLine2: addressLine2.trim() || null,
      postalCode: postalCode.trim() || null,
      city: city.trim() || null,
      countryCode: countryCode.trim() || null,
      billingEmail: billingEmail.trim() || null,
      billingPhone: billingPhone.trim() || null,
      iban: iban.trim() || null,
      bic: bic.trim() || null,
      bankName: bankName.trim() || null,
      accountHolder: accountHolder.trim() || null,
      billingLegalText: billingLegalText.trim() || null,
    };

    const res = await fetchJson<PatchResponse>(`/api/pro/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId ?? null);
    setSaving(false);

    if (!res.ok || !res.data?.item) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }

    setInfo('Profil de facturation mis à jour.');
    setLegalName(res.data.item.legalName ?? '');
    setWebsiteUrl(res.data.item.websiteUrl ?? '');
    setSiret(res.data.item.siret ?? '');
    setVatNumber(res.data.item.vatNumber ?? '');
    setAddressLine1(res.data.item.addressLine1 ?? '');
    setAddressLine2(res.data.item.addressLine2 ?? '');
    setPostalCode(res.data.item.postalCode ?? '');
    setCity(res.data.item.city ?? '');
    setCountryCode(res.data.item.countryCode ?? '');
    setBillingEmail(res.data.item.billingEmail ?? '');
    setBillingPhone(res.data.item.billingPhone ?? '');
    setIban(res.data.item.iban ?? '');
    setBic(res.data.item.bic ?? '');
    setBankName(res.data.item.bankName ?? '');
    setAccountHolder(res.data.item.accountHolder ?? '');
    setBillingLegalText(res.data.item.billingLegalText ?? '');
  }

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Profil de facturation</p>
        <p className="text-xs text-[var(--text-secondary)]">
          Coordonnées utilisées sur les devis et factures (si renseignées).
        </p>
      </div>
      {error ? <p className="text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
      {info ? <p className="text-xs text-[var(--success)]">{info}</p> : null}
      {requestId ? <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Raison sociale"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="Site web"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://exemple.com"
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="SIRET"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="Numéro TVA"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="Email facturation"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="Téléphone facturation"
            value={billingPhone}
            onChange={(e) => setBillingPhone(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </div>

        <div className="space-y-3">
          <AddressInput
            value={{ addressLine1, postalCode, city }}
            onChange={(fields) => {
              if (fields.addressLine1 !== undefined) setAddressLine1(fields.addressLine1);
              if (fields.postalCode !== undefined) setPostalCode(fields.postalCode);
              if (fields.city !== undefined) setCity(fields.city);
            }}
            countryCode={countryCode || 'FR'}
            disabled={!canEdit || loading || saving}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Complément d'adresse"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={!canEdit || loading || saving}
            />
            <Input
              label="Pays (ISO)"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              placeholder="FR"
              disabled={!canEdit || loading || saving}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="IBAN"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="BIC"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="Banque"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
          <Input
            label="Titulaire du compte"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[var(--text-secondary)]">Mentions légales</label>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={4}
            value={billingLegalText}
            onChange={(e) => setBillingLegalText(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canEdit || loading || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {!canEdit ? <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p> : null}
        </div>
      </form>
    </Card>
  );
}
