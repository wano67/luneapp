"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InitialsAvatar, SectionCard, SectionHeader } from '@/components/pro/projects/workspace-ui';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';

type TeamMember = {
  membershipId: string;
  email: string;
  name?: string | null;
  role: string;
};

type MemberGroup = {
  key: string;
  label: string;
  members: TeamMember[];
};

export type TeamTabProps = {
  membersByUnit: MemberGroup[];
  teamInfo: string | null;
  isAdmin: boolean;
  onOpenUnitsModal: () => void;
  businessId: string;
};

export function TeamTab({
  membersByUnit,
  teamInfo,
  isAdmin,
  onOpenUnitsModal,
  businessId,
}: TeamTabProps) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader
          title="Équipe"
          subtitle="Membres par pôle/secteur."
          actions={
            isAdmin ? (
              <Button size="sm" variant="outline" onClick={onOpenUnitsModal}>
                Gérer les pôles
              </Button>
            ) : null
          }
        />
        {teamInfo ? <p className="mt-2 text-sm text-[var(--success)]">{teamInfo}</p> : null}
      </SectionCard>

      {membersByUnit.length ? (
        <div className="space-y-3">
          {membersByUnit.map((group) => (
            <Card
              key={group.key}
              className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{group.label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{group.members.length} membres</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.members.map((member) => (
                  <div
                    key={member.membershipId}
                    className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                  >
                    <InitialsAvatar name={member.name} email={member.email} size={22} />
                    <span className="max-w-[160px] truncate text-[var(--text-primary)]">
                      {member.name ?? member.email}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">{member.role}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <GuidedCtaCard
          title="Aucun membre disponible."
          description="Invitez un membre pour commencer."
          primary={{ label: 'Ajouter un membre', href: `/app/pro/${businessId}/settings/team` }}
        />
      )}
    </div>
  );
}
