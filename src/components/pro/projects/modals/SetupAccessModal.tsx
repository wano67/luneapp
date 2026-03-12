"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { InitialsAvatar } from '@/components/pro/projects/workspace-ui';
import type { SetupAccessModalProps } from './setup-types';

export default function SetupAccessModal({
  isAdmin,
  projectMembers,
  availableMembers,
  accessInfo,
  onAddProjectMember,
  onRemoveProjectMember,
  onCloseAccessModal,
}: SetupAccessModalProps) {
  return (
    <Modal
      open
      onCloseAction={onCloseAccessModal}
      title="Accès au projet"
      description="Ajoute ou retire les membres autorisés à voir ce projet."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Accès actuel</p>
          {projectMembers.length ? (
            <div className="space-y-2">
              {projectMembers.map((member) => {
                const implicit = member.implicit || member.role === 'OWNER' || member.role === 'ADMIN';
                return (
                  <div
                    key={member.membershipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <InitialsAvatar name={member.user.name} email={member.user.email} size={24} />
                      <div className="min-w-0">
                        <p className="truncate text-[var(--text-primary)]">
                          {member.user.name ?? member.user.email}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {implicit ? <Badge variant="neutral">Accès implicite</Badge> : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveProjectMember(member.membershipId)}
                        disabled={!isAdmin || implicit}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Aucun membre associé.</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Ajouter un collaborateur</p>
          {availableMembers.length ? (
            <div className="space-y-2">
              {availableMembers.map((member) => (
                <div
                  key={member.membershipId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <InitialsAvatar name={member.name} email={member.email} size={24} />
                    <div className="min-w-0">
                      <p className="truncate text-[var(--text-primary)]">
                        {member.name ?? member.email}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">{member.role}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onAddProjectMember(member.membershipId)}
                    disabled={!isAdmin}
                  >
                    Ajouter
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Tous les membres sont déjà associés.</p>
          )}
        </div>
        {accessInfo ? <p className="text-sm text-[var(--success)]">{accessInfo}</p> : null}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCloseAccessModal}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
