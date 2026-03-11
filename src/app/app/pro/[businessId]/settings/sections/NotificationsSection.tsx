'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';

const NOTIFICATION_TYPES: { key: string; label: string; description: string }[] = [
  { key: 'TASK_ASSIGNED', label: 'Tâche assignée', description: 'Quand une tâche vous est assignée.' },
  { key: 'TASK_STATUS_CHANGED', label: 'Statut de tâche', description: 'Quand le statut d\'une tâche change.' },
  { key: 'TASK_DUE_SOON', label: 'Échéance proche', description: 'Quand une tâche arrive à échéance sous 24h.' },
  { key: 'TASK_BLOCKED', label: 'Tâche bloquée', description: 'Quand une tâche est marquée bloquée.' },
  { key: 'TASK_OVERDUE', label: 'Tâche en retard', description: 'Quand une tâche dépasse sa date d\'échéance.' },
  { key: 'MESSAGE_RECEIVED', label: 'Nouveau message', description: 'Quand un message est reçu dans une conversation.' },
  { key: 'PROJECT_OVERDUE', label: 'Projet en retard', description: 'Quand un projet dépasse sa date de fin.' },
  { key: 'CALENDAR_REMINDER', label: 'Rappel calendrier', description: 'Rappel avant un événement de votre calendrier business.' },
  { key: 'CLIENT_FOLLOWUP', label: 'Relance client', description: 'Quand un client actif n\'a pas eu d\'interaction depuis 21 jours.' },
  { key: 'PROSPECT_FOLLOWUP', label: 'Relance prospect', description: 'Quand un prospect actif n\'a pas été suivi depuis 24h.' },
  { key: 'BUSINESS_INVITE', label: 'Invitation business', description: 'Quand vous êtes invité à rejoindre un business.' },
  { key: 'INTERACTION_ADDED', label: 'Nouvelle interaction', description: 'Quand une interaction est ajoutée avec un client ou prospect.' },
  { key: 'DOCUMENT_UPLOADED', label: 'Document uploadé', description: 'Quand un document est ajouté à un projet.' },
  { key: 'INVOICE_CREATED', label: 'Facture créée', description: 'Quand une facture est générée pour un projet.' },
  { key: 'QUOTE_CREATED', label: 'Devis créé', description: 'Quand un devis est généré pour un projet.' },
];

type PrefsMap = Record<string, boolean>;

export function NotificationsSection({ businessId }: { businessId: string }) {
  const [prefs, setPrefs] = useState<PrefsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ preferences: PrefsMap }>(`/api/pro/businesses/${businessId}/notification-preferences`);
      setLoading(false);
      if (res.ok && res.data?.preferences) {
        setPrefs(res.data.preferences);
      }
    })();
  }, [businessId]);

  async function toggle(type: string, enabled: boolean) {
    setSaving(type); setError(null);
    // Optimistic update
    setPrefs((prev) => ({ ...prev, [type]: enabled }));

    const res = await fetchJson<{ preferences: PrefsMap }>(`/api/pro/businesses/${businessId}/notification-preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({ type, enabled }),
    });

    setSaving(null);
    if (!res.ok) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setError(msg);
      toast.error(msg);
      // Revert
      setPrefs((prev) => ({ ...prev, [type]: !enabled }));
      return;
    }
    if (res.data?.preferences) setPrefs(res.data.preferences);
  }

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Notifications</p>
        <p className="text-sm text-[var(--text-secondary)]">Choisissez les notifications que vous souhaitez recevoir pour ce business.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="space-y-2">
        {NOTIFICATION_TYPES.map((nt) => {
          const enabled = prefs[nt.key] ?? true;
          const isSaving = saving === nt.key;
          return (
            <label key={nt.key} className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={enabled}
                onChange={(e) => void toggle(nt.key, e.target.checked)}
                disabled={loading || isSaving}
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{nt.label}</div>
                <p className="text-xs text-[var(--text-secondary)]">{nt.description}</p>
              </div>
              {isSaving && <span className="text-xs text-[var(--text-secondary)]">…</span>}
            </label>
          );
        })}
      </div>
      {loading && <p className="text-xs text-[var(--text-secondary)]">Chargement…</p>}
    </Card>
  );
}
