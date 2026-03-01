"use client";

import { useState } from 'react';
import { X, Users, User } from 'lucide-react';

type Member = {
  userId: string;
  name: string | null;
  email: string;
};

type NewConversationModalProps = {
  open: boolean;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onCreate: (type: 'PRIVATE' | 'GROUP', memberUserIds: string[], name?: string) => Promise<string | null>;
};

function getMemberLabel(m: Member): string {
  return m.name || m.email;
}

export function NewConversationModal({
  open,
  members,
  currentUserId,
  onClose,
  onCreate,
}: NewConversationModalProps) {
  const [type, setType] = useState<'PRIVATE' | 'GROUP'>('PRIVATE');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const otherMembers = members.filter((m) => m.userId !== currentUserId);

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        if (type === 'PRIVATE') {
          // Only one selection for private
          return new Set([userId]);
        }
        next.add(userId);
      }
      return next;
    });
  };

  const canCreate =
    selectedIds.size > 0 &&
    (type === 'PRIVATE' ? selectedIds.size === 1 : groupName.trim().length > 0);

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    const result = await onCreate(type, [...selectedIds], groupName.trim() || undefined);
    setCreating(false);
    if (result) {
      setSelectedIds(new Set());
      setGroupName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Nouvelle conversation
          </h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setType('PRIVATE'); setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                type === 'PRIVATE'
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <User size={16} />
              Privée
            </button>
            <button
              onClick={() => { setType('GROUP'); setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                type === 'GROUP'
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Users size={16} />
              Groupe
            </button>
          </div>

          {/* Group name */}
          {type === 'GROUP' && (
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nom du groupe..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          )}

          {/* Member list */}
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
              {type === 'PRIVATE' ? 'Sélectionnez un membre' : 'Sélectionnez les membres'}
            </p>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {otherMembers.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--text-secondary)]">
                  Aucun autre membre dans le projet.
                </p>
              ) : (
                otherMembers.map((m) => {
                  const isSelected = selectedIds.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      onClick={() => toggleMember(m.userId)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary)]/10'
                          : 'hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-hover)] text-xs font-semibold text-[var(--text-secondary)]">
                        {(m.name?.charAt(0) || m.email.charAt(0)).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {getMemberLabel(m)}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">{m.email}</p>
                      </div>
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            {creating ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
