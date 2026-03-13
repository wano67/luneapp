'use client';

import { type FormEvent, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OrganizationUnit } from './hooks/types';

type Props = {
  open: boolean;
  onClose: () => void;
  unitToEdit: OrganizationUnit | null;
  actionLoading: boolean;
  onSubmit: (name: string) => Promise<void>;
};

export function UnitFormModal({ open, onClose, unitToEdit, actionLoading, onSubmit }: Props) {
  return (
    <Modal
      open={open}
      onCloseAction={actionLoading ? () => {} : onClose}
      title={unitToEdit ? 'Renommer le pôle' : 'Créer un pôle'}
      description="Les pôles permettent d&apos;organiser les membres par équipe ou département."
    >
      {open ? (
        <UnitForm
          initialName={unitToEdit?.name ?? ''}
          isRename={!!unitToEdit}
          actionLoading={actionLoading}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
}

function UnitForm({
  initialName,
  isRename,
  actionLoading,
  onClose,
  onSubmit,
}: {
  initialName: string;
  isRename: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
    if (!actionLoading) onClose();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <Input
        label="Nom du pôle"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        placeholder="Ex : Développement, Marketing…"
        disabled={actionLoading}
        data-autofocus="true"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onClose} disabled={actionLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={actionLoading || !name.trim()}>
          {actionLoading ? 'Enregistrement…' : isRename ? 'Renommer' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
