'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';

type BusinessSettings = {
  id: string;
  businessId: string;
  invoicePrefix: string;
  quotePrefix: string;
  defaultDepositPercent: number;
  paymentTermsDays: number;
  enableAutoNumbering: boolean;
  vatRatePercent: number;
  vatEnabled: boolean;
  allowMembersInvite: boolean;
  allowViewerExport: boolean;
  integrationStripeEnabled: boolean;
  integrationStripePublicKey: string | null;
};

type Field =
  | {
      key:
        | 'invoicePrefix'
        | 'quotePrefix'
        | 'integrationStripePublicKey';
      label: string;
      helper?: string;
      type: 'text';
      placeholder?: string;
      readOnly?: boolean;
    }
  | {
      key:
        | 'defaultDepositPercent'
        | 'paymentTermsDays'
        | 'vatRatePercent';
      label: string;
      helper?: string;
      type: 'number';
      min?: number;
      max?: number;
      suffix?: string;
      readOnly?: boolean;
    }
  | {
      key:
        | 'enableAutoNumbering'
        | 'vatEnabled'
        | 'allowMembersInvite'
        | 'allowViewerExport'
        | 'integrationStripeEnabled';
      label: string;
      helper?: string;
      type: 'checkbox';
      readOnly?: boolean;
    };

type Props = {
  businessId: string;
  title: string;
  description?: string;
  fields: Field[];
};

export function SettingsForm({ businessId, title, description, fields }: Props) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (settings) {
      setForm({
        invoicePrefix: settings.invoicePrefix,
        quotePrefix: settings.quotePrefix,
        defaultDepositPercent: settings.defaultDepositPercent,
        paymentTermsDays: settings.paymentTermsDays,
        enableAutoNumbering: settings.enableAutoNumbering,
        vatRatePercent: settings.vatRatePercent,
        vatEnabled: settings.vatEnabled,
        allowMembersInvite: settings.allowMembersInvite,
        allowViewerExport: settings.allowViewerExport,
        integrationStripeEnabled: settings.integrationStripeEnabled,
        integrationStripePublicKey: settings.integrationStripePublicKey ?? '',
      });
    }
  }, [settings]);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    setInfo(null);
    const res = await fetchJson<{ item: BusinessSettings }>(
      `/api/pro/businesses/${businessId}/settings`
    );
    setRequestId(res.requestId);
    setLoading(false);
    if (!res.ok || !res.data?.item) {
      const msg = res.error ?? 'Impossible de charger les paramètres.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSettings(null);
      return;
    }
    setSettings(res.data.item);
  }

  function onFieldChange(key: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setInfo(readOnlyMessage);
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);

    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = form[field.key];
      if (field.type === 'checkbox') {
        if (typeof value === 'boolean') payload[field.key] = value;
      } else if (field.type === 'number') {
        if (value !== undefined && value !== null && value !== '') {
          payload[field.key] = Number(value);
        }
      } else if (field.type === 'text') {
        payload[field.key] = (value ?? '').toString();
      }
    }

    const res = await fetchJson<{ item: BusinessSettings }>(
      `/api/pro/businesses/${businessId}/settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
        body: JSON.stringify(payload),
      }
    );
    setRequestId(res.requestId);
    setSaving(false);

    if (!res.ok || !res.data?.item) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }

    setSettings(res.data.item);
    setInfo('Paramètres enregistrés.');
  }

  const visibleFields = useMemo(
    () => fields.map((f) => ({ ...f, value: form[f.key] })),
    [fields, form]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-[var(--text-faint)]">{description}</p>}
      </div>

      {info && <div className="text-sm text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)] px-3 py-2 rounded">{info}</div>}
      {error && <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">{error}</div>}
      {requestId && (
        <div className="text-xs text-[var(--text-faint)]">
          Request ID: <code>{requestId}</code>
        </div>
      )}

      <Card className="p-4">
        {loading && <p>Chargement…</p>}
        {!loading && settings && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleFields.map((field) => {
                const disabled = saving || !isAdmin || Boolean(field.readOnly);
                if (field.type === 'checkbox') {
                  return (
                    <label key={field.key} className="flex items-start gap-3 border border-[var(--border)] rounded-xl px-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(field.value)}
                        disabled={disabled}
                        onChange={(e) => onFieldChange(field.key, e.target.checked)}
                      />
                      <div>
                        <div className="font-medium">{field.label}</div>
                        {field.helper && <p className="text-sm text-[var(--text-faint)]">{field.helper}</p>}
                      </div>
                    </label>
                  );
                }
                return (
                  <div key={field.key} className="space-y-1">
                    <label className="text-sm font-medium">{field.label}</label>
                    <Input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={(field.value as string | number | undefined) ?? ''}
                      placeholder={field.type === 'text' ? field.placeholder : undefined}
                      min={field.type === 'number' ? field.min : undefined}
                      max={field.type === 'number' ? field.max : undefined}
                      disabled={disabled}
                      onChange={(e) =>
                        onFieldChange(
                          field.key,
                          field.type === 'number'
                            ? e.target.value === ''
                              ? ''
                              : Number(e.target.value)
                            : e.target.value
                        )
                      }
                    />
                    {field.helper && (
                      <p className="text-xs text-[var(--text-faint)]">
                        {field.helper}
                        {field.type === 'number' && field.suffix ? ` (${field.suffix})` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving || !isAdmin}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {!isAdmin && <p className="text-sm text-[var(--text-faint)]">{readOnlyMessage}</p>}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
