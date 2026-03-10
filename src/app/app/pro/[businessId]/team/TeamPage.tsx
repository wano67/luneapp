'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { Search, Users, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import {
  ROLE_LABELS, canChangeRole, allowedRoles, canEditEmployeeProfile, canRemove, formatDate,
  type BusinessRole, type Member,
} from './hooks/types';
import { useTeamData } from './hooks/useTeamData';
import { useInviteManagement } from './hooks/useInviteManagement';
import { useMemberActions } from './hooks/useMemberActions';
import { useOrganizationUnits } from './hooks/useOrganizationUnits';
import { RoleChangeModal } from './RoleChangeModal';
import { RemoveMemberModal } from './RemoveMemberModal';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { UnitFormModal } from './UnitFormModal';
import type { OrganizationUnit } from './hooks/types';

const TABS = [
  { key: 'membres', label: 'Membres' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'poles', label: 'Pôles' },
] as const;

const ROLE_FILTERS: { value: BusinessRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
];

const STATUS_FILTERS: { value: 'ALL' | 'ACTIVE' | 'INACTIVE'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'INACTIVE', label: 'Inactifs' },
];

type Props = { businessId: string };

export default function TeamPage({ businessId }: Props) {
  const [activeTab, setActiveTab] = useState('membres');

  // Auth
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role as BusinessRole | undefined;
  const canInvite = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const isAdmin = canInvite;

  // Data hooks
  const teamData = useTeamData({ businessId });
  const invites = useInviteManagement({
    businessId, canInvite, load: teamData.load, redirectToLogin: teamData.redirectToLogin,
  });
  const memberActions = useMemberActions({
    businessId, actorRole, currentUserId: teamData.currentUserId,
    load: teamData.load, redirectToLogin: teamData.redirectToLogin,
  });
  const orgUnits = useOrganizationUnits({ businessId, redirectToLogin: teamData.redirectToLogin });

  // Filters (Membres tab)
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<BusinessRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Invitations: archive toggle
  const [showArchived, setShowArchived] = useState(false);

  // Unit modal state
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<OrganizationUnit | null>(null);

  // Filtered members
  const filteredMembers = useMemo(() => {
    let result = teamData.sortedMembers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.email.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'ALL') result = result.filter((m) => m.role === roleFilter);
    if (statusFilter === 'ACTIVE') result = result.filter((m) => m.employeeProfile?.status === 'ACTIVE');
    if (statusFilter === 'INACTIVE') result = result.filter((m) => !m.employeeProfile || m.employeeProfile.status === 'INACTIVE');
    return result;
  }, [teamData.sortedMembers, search, roleFilter, statusFilter]);

  // KPIs
  const totalCount = teamData.sortedMembers.length;
  const activeCount = teamData.sortedMembers.filter((m) => m.employeeProfile?.status === 'ACTIVE').length;
  const inactiveCount = totalCount - activeCount;
  const pendingInviteCount = teamData.invites.filter((i) => i.status === 'PENDING').length;

  // Unit member counts
  const unitMemberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of teamData.sortedMembers) {
      if (m.organizationUnit) {
        counts[m.organizationUnit.id] = (counts[m.organizationUnit.id] ?? 0) + 1;
      }
    }
    return counts;
  }, [teamData.sortedMembers]);

  // Unit modal handlers
  function openCreateUnit() {
    setUnitToEdit(null);
    setUnitModalOpen(true);
  }

  function openRenameUnit(unit: OrganizationUnit) {
    setUnitToEdit(unit);
    setUnitModalOpen(true);
  }

  async function handleUnitSubmit(name: string) {
    if (unitToEdit) {
      await orgUnits.renameUnit(unitToEdit.id, name);
    } else {
      await orgUnits.createUnit(name);
    }
    setUnitModalOpen(false);
  }

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Équipe"
      subtitle="Membres, invitations et organisation de l&apos;équipe."
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={canInvite ? (
        <Button size="sm" onClick={() => setActiveTab('invitations')}>Inviter</Button>
      ) : undefined}
    >
      {/* ─── Onglet Membres ─── */}
      {activeTab === 'membres' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total membres" value={totalCount} loading={teamData.loading} delay={0} />
            <KpiCard label="Actifs" value={activeCount} loading={teamData.loading} delay={50} />
            <KpiCard label="Inactifs" value={inactiveCount} loading={teamData.loading} delay={100} />
            <KpiCard label="Invitations en attente" value={pendingInviteCount} loading={teamData.loading} delay={150} />
          </div>

          {/* Feedback */}
          {teamData.error ? <p className="text-xs text-[var(--danger)]">{teamData.error}</p> : null}
          {memberActions.actionError ? <p className="text-xs text-[var(--danger)]">{memberActions.actionError}</p> : null}
          {memberActions.success ? <p className="text-xs text-[var(--success)]">{memberActions.success}</p> : null}

          {/* Search + Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-sm font-semibold text-[var(--text)]">Membres</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5">
                <Search size={14} className="text-[var(--text-faint)]" />
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[140px] bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
                />
              </div>
              <div className="flex items-center gap-1">
                {ROLE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setRoleFilter(f.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      roleFilter === f.value
                        ? 'bg-[var(--shell-accent)] text-white'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      statusFilter === f.value
                        ? 'bg-[var(--shell-accent)] text-white'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Members Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom / Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="hidden md:table-cell">Poste</TableHead>
                <TableHead className="hidden sm:table-cell">Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Pôle</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamData.loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-20 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredMembers.length === 0 ? (
                <TableEmpty>Aucun membre trouvé.</TableEmpty>
              ) : (
                filteredMembers.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    actorRole={actorRole}
                    currentUserId={teamData.currentUserId}
                    actorPermissions={teamData.actorMember?.permissions}
                    actionLoading={memberActions.actionLoading}
                    roleValueFor={memberActions.roleValueFor}
                    onRoleChange={memberActions.onRoleChange}
                    openEmployeeModal={memberActions.openEmployeeModal}
                    setRemoveModal={memberActions.setRemoveModal}
                    setActionError={memberActions.setActionError}
                    setSuccess={memberActions.setSuccess}
                    units={orgUnits.units}
                    assignMemberToUnit={orgUnits.assignMemberToUnit}
                    onUnitAssigned={async () => { await teamData.load(); await orgUnits.load(); }}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </>
      )}

      {/* ─── Onglet Invitations ─── */}
      {activeTab === 'invitations' && (
        <>
          {/* Invite form */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Inviter un collaborateur</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Les invitations expirent au bout de 7 jours. Rôles autorisés : Admin, Member, Viewer.
              </p>
            </div>

            {invites.inviteError ? <p className="text-xs text-[var(--danger)]">{invites.inviteError}</p> : null}
            {invites.inviteSuccess ? <p className="text-xs text-[var(--success)]">{invites.inviteSuccess}</p> : null}

            {!canInvite ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Seuls les Owner/Admin peuvent inviter de nouveaux collaborateurs.
              </p>
            ) : (
              <form
                className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr,0.8fr,auto]"
                onSubmit={(e: FormEvent<HTMLFormElement>) => void invites.onInviteSubmit(e)}
              >
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={invites.inviteDraft.email}
                  onChange={(e) => invites.setInviteDraft((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={invites.inviteLoading}
                  required
                />
                <Select
                  value={invites.inviteDraft.role}
                  onChange={(e) => invites.setInviteDraft((prev) => ({ ...prev, role: e.target.value as BusinessRole }))}
                  disabled={invites.inviteLoading}
                  required
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </Select>
                <Button type="submit" disabled={invites.inviteLoading}>
                  {invites.inviteLoading ? 'Envoi…' : 'Envoyer l’invitation'}
                </Button>
              </form>
            )}

            {invites.lastInviteLink ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                <p>Lien généré :</p>
                <code className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px]">
                  /app/invites/accept?token=…
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={invites.inviteLoading}
                  onClick={() => void invites.copyInviteLink(invites.lastInviteLink!)}
                >
                  Copier le lien
                </Button>
              </div>
            ) : null}
          </div>

          {/* Active invitations list (PENDING + ACCEPTED) */}
          {(() => {
            const activeInvites = teamData.invites.filter(i => i.status === 'PENDING' || i.status === 'ACCEPTED');
            const archivedInvites = teamData.invites.filter(i => i.status === 'REVOKED' || i.status === 'EXPIRED');
            return (
              <>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Invitations actives</p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Révoque une invitation pour la rendre invalide immédiatement.
                    </p>
                  </div>

                  {teamData.loading ? (
                    <p className="text-sm text-[var(--text-secondary)]">Chargement des invitations…</p>
                  ) : activeInvites.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">Aucune invitation active.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeInvites.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-[var(--text)]">{inv.email}</p>
                              {inv.userExists === true && (
                                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">Compte existant</span>
                              )}
                              {inv.userExists === false && (
                                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">Nouveau</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="neutral">{ROLE_LABELS[inv.role]}</Badge>
                              <Badge variant={inv.status === 'ACCEPTED' ? 'success' : 'neutral'}>
                                {inv.status === 'ACCEPTED' ? 'Acceptée' : 'En attente'}
                              </Badge>
                              <span className="text-[10px] text-[var(--text-secondary)]">
                                Envoyée le {formatDate(inv.createdAt)}
                              </span>
                              {inv.expiresAt && inv.status === 'PENDING' ? (
                                <InviteExpiry expiresAt={inv.expiresAt} />
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {inv.inviteLink && inv.status === 'PENDING' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void invites.copyInviteLink(inv.inviteLink!)}
                                >
                                  Copier le lien
                                </Button>
                                <a
                                  className="text-xs text-[var(--accent-strong)] underline"
                                  href={inv.inviteLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ouvrir
                                </a>
                              </>
                            ) : null}
                            {inv.status === 'PENDING' && canInvite ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={invites.inviteLoading}
                                onClick={() => void invites.onRevokeInvite(inv.id)}
                              >
                                Révoquer
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Archived invitations (REVOKED + EXPIRED) — collapsible */}
                {archivedInvites.length > 0 && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left"
                      onClick={() => setShowArchived((v) => !v)}
                    >
                      {showArchived
                        ? <ChevronDown size={14} className="text-[var(--text-secondary)]" />
                        : <ChevronRight size={14} className="text-[var(--text-secondary)]" />}
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">
                        Invitations archivées ({archivedInvites.length})
                      </p>
                    </button>

                    {showArchived && (
                      <div className="space-y-2">
                        {archivedInvites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 opacity-60 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[var(--text)]">{inv.email}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="neutral">{ROLE_LABELS[inv.role]}</Badge>
                                <Badge variant="warning">
                                  {inv.status === 'EXPIRED' ? 'Expirée' : 'Révoquée'}
                                </Badge>
                                <span className="text-[10px] text-[var(--text-secondary)]">
                                  Envoyée le {formatDate(inv.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ─── Onglet Pôles ─── */}
      {activeTab === 'poles' && (
        <>
          {/* Header + feedback */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Pôles / Départements</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Organise les membres par équipe ou département.
              </p>
            </div>
            {isAdmin ? (
              <Button size="sm" onClick={openCreateUnit}>
                <Plus size={14} className="mr-1" /> Créer un pôle
              </Button>
            ) : null}
          </div>

          {orgUnits.actionError ? <p className="text-xs text-[var(--danger)]">{orgUnits.actionError}</p> : null}
          {orgUnits.success ? <p className="text-xs text-[var(--success)]">{orgUnits.success}</p> : null}

          {orgUnits.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-[var(--surface-2)] animate-skeleton-pulse" />
              ))}
            </div>
          ) : orgUnits.units.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Aucun pôle créé.</p>
              {isAdmin ? (
                <Button size="sm" className="mt-3" onClick={openCreateUnit}>Créer un pôle</Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {orgUnits.units.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{unit.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {unitMemberCounts[unit.id] ?? 0} membre{(unitMemberCounts[unit.id] ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openRenameUnit(unit)}
                        disabled={orgUnits.actionLoading}
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => void orgUnits.deleteUnit(unit.id)}
                        disabled={orgUnits.actionLoading}
                        className="rounded-lg p-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <RoleChangeModal
        roleModal={memberActions.roleModal}
        actionLoading={memberActions.actionLoading}
        cancelRoleChange={memberActions.cancelRoleChange}
        confirmRoleChange={memberActions.confirmRoleChange}
      />
      <RemoveMemberModal
        removeModal={memberActions.removeModal}
        actionLoading={memberActions.actionLoading}
        setRemoveModal={memberActions.setRemoveModal}
        confirmRemoval={memberActions.confirmRemoval}
      />
      <EmployeeProfileModal
        employeeModal={memberActions.employeeModal}
        setEmployeeModal={memberActions.setEmployeeModal}
        employeeDraft={memberActions.employeeDraft}
        setEmployeeDraft={memberActions.setEmployeeDraft}
        actionLoading={memberActions.actionLoading}
        saveEmployeeProfile={memberActions.saveEmployeeProfile}
      />
      <UnitFormModal
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        unitToEdit={unitToEdit}
        actionLoading={orgUnits.actionLoading}
        onSubmit={handleUnitSubmit}
      />
    </ProPageShell>
  );
}

// ─── MemberRow sub-component ─────────────────────────────────────────────────

type MemberRowProps = {
  member: Member;
  actorRole: BusinessRole | undefined;
  currentUserId: string | null;
  actorPermissions: string[] | undefined;
  actionLoading: boolean;
  roleValueFor: (m: Member) => BusinessRole;
  onRoleChange: (m: Member, value: string) => void;
  openEmployeeModal: (m: Member) => void;
  setRemoveModal: (m: Member | null) => void;
  setActionError: (e: string | null) => void;
  setSuccess: (s: string | null) => void;
  units: OrganizationUnit[];
  assignMemberToUnit: (membershipId: string, unitId: string | null) => Promise<void>;
  onUnitAssigned: () => Promise<void>;
};

function MemberRow({
  member, actorRole, currentUserId, actorPermissions,
  actionLoading, roleValueFor, onRoleChange,
  openEmployeeModal, setRemoveModal, setActionError, setSuccess,
  units, assignMemberToUnit, onUnitAssigned,
}: MemberRowProps) {
  const canEdit = canChangeRole(actorRole, member, currentUserId);
  const canDelete = canRemove(actorRole, member, currentUserId);
  const options = allowedRoles(actorRole, member);
  const canProfile = canEditEmployeeProfile(actorRole, actorPermissions as never, member);
  const isMe = member.userId === currentUserId;
  const isAdminActor = actorRole === 'OWNER' || actorRole === 'ADMIN';

  async function handleUnitChange(unitId: string) {
    await assignMemberToUnit(member.membershipId, unitId || null);
    await onUnitAssigned();
  }

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="text-sm font-medium text-[var(--text)]">
            {member.name ?? member.email}
            {isMe ? <span className="ml-1.5 text-[10px] text-[var(--text-faint)]">(toi)</span> : null}
          </p>
          {member.name ? (
            <p className="text-xs text-[var(--text-secondary)]">{member.email}</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Select
            value={roleValueFor(member)}
            onChange={(e) => onRoleChange(member, e.target.value)}
            disabled={actionLoading}
          >
            {options.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </Select>
        ) : (
          <Badge variant="neutral">{ROLE_LABELS[member.role]}</Badge>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="text-sm text-[var(--text-secondary)]">
          {member.employeeProfile?.jobTitle ?? '—'}
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {member.employeeProfile ? (
          <Badge variant={member.employeeProfile.status === 'ACTIVE' ? 'success' : 'warning'}>
            {member.employeeProfile.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
          </Badge>
        ) : (
          <span className="text-xs text-[var(--text-faint)]">—</span>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {isAdminActor ? (
          <select
            value={member.organizationUnit?.id ?? ''}
            onChange={(e) => void handleUnitChange(e.target.value)}
            disabled={actionLoading}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] outline-none"
          >
            <option value="">Aucun</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-[var(--text-secondary)]">
            {member.organizationUnit?.name ?? '—'}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {canProfile ? (
            <Button size="sm" variant="outline" onClick={() => openEmployeeModal(member)} disabled={actionLoading}>
              Profil
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRemoveModal(member);
                setActionError(null);
                setSuccess(null);
              }}
              disabled={actionLoading}
            >
              Retirer
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── InviteExpiry helper ─────────────────────────────────────────────────────

function InviteExpiry({ expiresAt }: { expiresAt: string }) {
  const label = useMemo(() => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    return diff <= 0
      ? `Expirée le ${formatDate(expiresAt)}`
      : `Expire dans ${Math.ceil(diff / 86_400_000)} j`;
  }, [expiresAt]);
  return <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>;
}
