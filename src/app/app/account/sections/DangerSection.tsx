'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';

export function DangerSection() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!password.trim()) {
      setError('Mot de passe requis.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetchJson<{ deleted?: boolean }>('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok && res.data?.deleted) {
        try {
          localStorage.removeItem('activeProBusinessId');
          localStorage.removeItem('lastProBusinessId');
        } catch { /* ignore */ }
        router.push('/login');
        return;
      }

      setError(res.error || 'Erreur lors de la suppression.');
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="border-[var(--danger)]/30 bg-[var(--danger)]/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[var(--danger)]">Supprimer mon compte</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Cette action est irréversible. Toutes vos données personnelles, comptes, transactions et entreprises sans autres membres seront supprimées.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Supprimer mon compte
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onCloseAction={() => {
          if (loading) return;
          setConfirmOpen(false);
          setPassword('');
          setError(null);
        }}
        title="Supprimer définitivement votre compte"
        description="Cette action est irréversible. Entrez votre mot de passe pour confirmer."
      >
        <div className="space-y-4">
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
            placeholder="Votre mot de passe"
            autoFocus
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setPassword('');
                setError(null);
              }}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={loading || !password.trim()}
            >
              {loading ? 'Suppression\u2026' : 'Supprimer définitivement'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
