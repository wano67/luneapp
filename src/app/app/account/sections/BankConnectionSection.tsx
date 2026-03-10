'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { RefreshCw, Unplug, Building2 } from 'lucide-react';

type ConnectionInfo = {
  id: number;
  state: string;
  bankName: string | null;
};

type PowensStatus = {
  connected: boolean;
  lastSyncAt: string | null;
  accountCount: number;
  connections: ConnectionInfo[];
};

export function BankConnectionSection() {
  const toast = useToast();
  const [status, setStatus] = useState<PowensStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch('/api/personal/powens/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as PowensStatus;
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/personal/powens/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as { accountsSynced?: number; transactionsAdded?: number };
        toast.success(`${data.accountsSynced || 0} comptes, ${data.transactionsAdded || 0} transactions synchronisés`);
        await loadStatus();
      } else {
        toast.error('Erreur de synchronisation');
      }
    } catch {
      toast.error('Erreur de synchronisation');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/personal/powens/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Connexion bancaire supprimée');
        setStatus({ connected: false, lastSyncAt: null, accountCount: 0, connections: [] });
        setConfirmDisconnect(false);
      } else {
        toast.error('Impossible de déconnecter');
      }
    } catch {
      toast.error('Impossible de déconnecter');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleReconnect(connectionId: number) {
    try {
      const res = await fetch('/api/personal/powens/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json() as { webviewUrl?: string };
      if (res.ok && data.webviewUrl) {
        window.location.href = data.webviewUrl;
      } else {
        toast.error('Impossible de reconnecter');
      }
    } catch {
      toast.error('Impossible de reconnecter');
    }
  }

  const stateLabels: Record<string, { label: string; color: string }> = {
    valid: { label: 'Active', color: 'var(--success)' },
    wrongpass: { label: 'Identifiants expirés', color: 'var(--danger)' },
    bug: { label: 'Erreur', color: 'var(--danger)' },
    websiteUnavailable: { label: 'Banque indisponible', color: 'var(--text-faint)' },
    actionNeeded: { label: 'Action requise', color: 'var(--warning, var(--danger))' },
  };

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Connexion bancaire</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Gérez votre connexion automatique aux banques via Powens (Open Banking).
        </p>
      </div>

      {loading ? (
        <div className="h-16 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
      ) : !status?.connected ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm text-[var(--text-faint)]">
            Aucune connexion bancaire active.
          </p>
          <p className="text-xs text-[var(--text-faint)] mt-1">
            Connectez votre banque depuis la page Comptes pour synchroniser automatiquement vos données.
          </p>
        </div>
      ) : (
        <>
          {/* Connexion info */}
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
            {status.connections.map((c) => {
              const stateInfo = stateLabels[c.state] || { label: c.state, color: 'var(--text-faint)' };
              const needsReconnect = c.state === 'wrongpass' || c.state === 'actionNeeded';

              return (
                <div key={c.id} className="flex items-center justify-between p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 size={16} className="text-[var(--text-faint)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">
                        {c.bankName || `Connexion #${c.id}`}
                      </p>
                      <p className="text-xs" style={{ color: stateInfo.color }}>
                        {stateInfo.label}
                      </p>
                    </div>
                  </div>
                  {needsReconnect ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReconnect(c.id)}
                    >
                      Reconnecter
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-[var(--text-faint)]">
            <span>{status.accountCount} {status.accountCount > 1 ? 'comptes synchronisés' : 'compte synchronisé'}</span>
            {status.lastSyncAt ? (
              <span>Dernière sync : {new Date(status.lastSyncAt).toLocaleString('fr-FR')}</span>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </Button>
            {confirmDisconnect ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--danger)]">Supprimer la connexion ?</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="!border-[var(--danger)] !text-[var(--danger)]"
                >
                  {disconnecting ? 'Suppression…' : 'Confirmer'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmDisconnect(true)}
                className="!text-[var(--danger)]"
              >
                <Unplug size={14} />
                Déconnecter
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
