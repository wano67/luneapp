'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { revalidate } from '@/lib/revalidate';

type VaultItemMeta = {
  id: string;
  title: string;
  identifier: string | null;
  email: string | null;
  note: string | null;
  projectId: string | null;
};

type Props = {
  open: boolean;
  onCloseAction: () => void;
  businessId: string;
  projectId?: string | null;
  editingItem?: VaultItemMeta | null;
  onSaved: () => void;
};

export function VaultItemModal({ open, onCloseAction, businessId, projectId, editingItem, onSaved }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [title, setTitle] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');

  const isEdit = !!editingItem;

  useEffect(() => {
    if (open) {
      setError(null);
      setShowPassword(false);
      if (editingItem) {
        setTitle(editingItem.title);
        setIdentifier(editingItem.identifier ?? '');
        setEmail(editingItem.email ?? '');
        setPassword('');
        setNote(editingItem.note ?? '');
      } else {
        setTitle('');
        setIdentifier('');
        setEmail('');
        setPassword('');
        setNote('');
      }
    }
  }, [open, editingItem]);

  async function handleSubmit() {
    if (!title.trim()) { setError('Titre requis.'); return; }
    if (!isEdit && !password) { setError('Mot de passe requis.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        identifier: identifier.trim() || null,
        email: email.trim() || null,
        note: note.trim() || null,
      };
      if (!isEdit) {
        payload.password = password;
        payload.projectId = projectId ?? null;
      } else if (password) {
        payload.password = password;
      }

      const url = isEdit
        ? `/api/pro/businesses/${businessId}/vault/${editingItem!.id}`
        : `/api/pro/businesses/${businessId}/vault`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(res.error ?? 'Erreur.');
        return;
      }
      toast.success(isEdit ? 'Identifiant modifié.' : 'Identifiant ajouté.');
      revalidate('pro:vault');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onCloseAction={saving ? () => {} : onCloseAction}
      title={isEdit ? 'Modifier l\'identifiant' : 'Nouvel identifiant'}
      description={isEdit ? 'Modifiez les informations.' : 'Ajoutez un identifiant au trousseau.'}
    >
      <div className="space-y-3">
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        <label className="block text-sm">
          <span className="block text-xs text-[var(--text-secondary)] mb-1">Titre *</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Hébergeur OVH" />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-[var(--text-secondary)] mb-1">Identifiant</span>
          <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Nom d'utilisateur" />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-[var(--text-secondary)] mb-1">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-[var(--text-secondary)] mb-1">
            Mot de passe {isEdit ? '(laisser vide pour ne pas changer)' : '*'}
          </span>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? '••••••••' : ''}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-[var(--text-secondary)] mb-1">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Notes additionnelles..."
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCloseAction} disabled={saving}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (isEdit ? 'Modification…' : 'Création…') : (isEdit ? 'Modifier' : 'Créer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
