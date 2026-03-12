'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { Plus, Trash2, Copy, Ban, UserCheck, X } from 'lucide-react';

type AccessItem = {
  id: string;
  accountantUserId: string;
  token: string;
  accessLevel: string;
  accountantName: string | null;
  accountantEmail: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessAt: string | null;
  portalUrl: string;
  createdAt: string;
};

export default function AccountantPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/accountant-access`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isOwner = role === 'OWNER';

  const [items, setItems] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [accountantUserId, setAccountantUserId] = useState('');
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: AccessItem[] }>(basePath);
      if (res.ok && res.data?.items) {
        setItems(res.data.items);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, basePath]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!accountantUserId.trim()) { setError('ID utilisateur requis.'); return; }
    setSaving(true);
    setError(null);
    const res = await fetchJson<{ item: AccessItem }>(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountantUserId: accountantUserId.trim(), accessLevel }),
    });
    setSaving(false);
    if (res.ok && res.data?.item) {
      setItems((prev) => [res.data!.item, ...prev]);
      setShowForm(false);
      setAccountantUserId('');
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  async function revokeAccess(id: string) {
    const res = await fetchJson<{ item: AccessItem }>(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revoke: true }),
    });
    if (res.ok && res.data?.item) {
      setItems((prev) => prev.map((i) => (i.id === id ? res.data!.item : i)));
    }
  }

  async function deleteAccess(id: string) {
    if (!window.confirm('Supprimer cet accès ?')) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function copyPortalUrl(portalUrl: string) {
    const fullUrl = `${window.location.origin}${portalUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setInfo('Lien du portail copié.');
    setTimeout(() => setInfo(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Espace expert-comptable</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Accordez un accès sécurisé à votre expert-comptable.
            </p>
          </div>
        </div>
        {isOwner && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouvel accès
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}
      {info && (
        <div className="text-sm text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)] px-3 py-2 rounded">
          {info}
        </div>
      )}

      {showForm && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Nouvel accès expert-comptable</h2>
            <button onClick={() => setShowForm(false)} className="text-[var(--text-faint)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">ID utilisateur comptable</label>
                <Input required placeholder="ID de l'utilisateur" value={accountantUserId} onChange={(e) => setAccountantUserId(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Niveau d&apos;accès</label>
                <select className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} disabled={saving}>
                  <option value="READ_ONLY">Lecture seule</option>
                  <option value="READ_WRITE">Lecture et écriture</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'En cours...' : 'Créer l\'accès'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expert-comptable</TableHead>
              <TableHead>Accès</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernier accès</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && <TableEmpty>Aucun accès expert-comptable configuré.</TableEmpty>}
            {!loading && items.map((item) => {
              const isActive = !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt) > new Date());
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.accountantName ?? 'Comptable'}</span>
                      {item.accountantEmail && <p className="text-xs text-[var(--text-faint)]">{item.accountantEmail}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{item.accessLevel === 'READ_WRITE' ? 'Lecture/Écriture' : 'Lecture seule'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isActive ? 'pro' : 'danger'}>
                      {item.revokedAt ? 'Révoqué' : isActive ? 'Actif' : 'Expiré'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.lastAccessAt ? new Date(item.lastAccessAt).toLocaleDateString('fr-FR') : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{new Date(item.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {isActive && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => copyPortalUrl(item.portalUrl)} title="Copier le lien">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => revokeAccess(item.id)} title="Révoquer">
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="danger" onClick={() => deleteAccess(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
