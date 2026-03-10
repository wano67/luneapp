'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Users, Building2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrganizationUnit, Member } from './hooks/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  units: OrganizationUnit[];
  members: Member[];
  loading: boolean;
};

type UnitTreeNode = Omit<OrganizationUnit, 'children'> & {
  children: UnitTreeNode[];
};

// ─── Tree builder ────────────────────────────────────────────────────────────

function buildTree(units: OrganizationUnit[]): UnitTreeNode[] {
  const map = new Map<string, UnitTreeNode>();
  for (const u of units) {
    // Destructure to drop the original children array and replace with our typed one
    const { children: _ignored, ...rest } = u;
    void _ignored;
    map.set(u.id, { ...rest, children: [] as UnitTreeNode[] });
  }
  const roots: UnitTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort siblings by order
  const sortChildren = (nodes: UnitTreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);
  return roots;
}

// ─── Contract type labels ────────────────────────────────────────────────────

const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  FREELANCE: 'Freelance',
  INTERN: 'Stage',
  APPRENTICE: 'Alternance',
  OTHER: 'Autre',
};

function contractLabel(type: string | null | undefined): string {
  if (!type) return '';
  return CONTRACT_LABELS[type] ?? type;
}

// ─── Member row ──────────────────────────────────────────────────────────────

function MemberRow({ member }: { member: Member }) {
  const profile = member.employeeProfile;
  const displayName = member.name || member.email;
  const status = profile?.status ?? 'INACTIVE';

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)]">
        <User size={14} className="text-[var(--text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] truncate">
          {displayName}
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          {profile?.jobTitle && <span>{profile.jobTitle}</span>}
          {profile?.jobTitle && profile?.contractType && (
            <span className="text-[var(--text-faint)]">&middot;</span>
          )}
          {profile?.contractType && <span>{contractLabel(profile.contractType)}</span>}
        </div>
      </div>
      <Badge variant={status === 'ACTIVE' ? 'success' : 'neutral'}>
        {status === 'ACTIVE' ? 'Actif' : 'Inactif'}
      </Badge>
    </div>
  );
}

// ─── Unit node (recursive) ──────────────────────────────────────────────────

function UnitNode({
  node,
  members,
  depth,
}: {
  node: UnitTreeNode;
  members: Member[];
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const unitMembers = members.filter(
    (m) => m.organizationUnit?.id === node.id,
  );
  const memberCount = unitMembers.length;
  const hasChildren = node.children.length > 0;
  const hasContent = memberCount > 0 || hasChildren;

  return (
    <div className={depth > 0 ? 'pl-6' : ''}>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
        >
          <span className="text-[var(--text-secondary)]">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <Building2 size={16} className="text-[var(--text-secondary)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--text)] flex-1 truncate">
            {node.name}
          </span>
          <Badge variant="neutral">
            <Users size={12} />
            {memberCount}
          </Badge>
        </button>

        {/* Expanded content */}
        {expanded && hasContent && (
          <div className="border-t border-[var(--border)]">
            {/* Members */}
            {memberCount > 0 && (
              <div className="px-3 py-2 space-y-0.5">
                {unitMembers.map((m) => (
                  <MemberRow key={m.membershipId} member={m} />
                ))}
              </div>
            )}

            {/* Child units */}
            {hasChildren && (
              <div className="px-3 pb-3 space-y-2">
                {memberCount > 0 && (
                  <div className="border-t border-[var(--border)] my-2" />
                )}
                {node.children.map((child) => (
                  <UnitNode
                    key={child.id}
                    node={child}
                    members={members}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty unit */}
        {expanded && !hasContent && (
          <div className="border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--text-faint)]">Aucun membre dans ce pôle</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function OrganigrammeSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton width="16px" height="16px" />
            <Skeleton width="16px" height="16px" />
            <Skeleton width="40%" height="16px" />
            <div className="ml-auto">
              <Skeleton width="48px" height="22px" />
            </div>
          </div>
          <div className="space-y-2 pl-8">
            <div className="flex items-center gap-3">
              <Skeleton circle width="32px" height="32px" />
              <div className="flex-1 space-y-1">
                <Skeleton width="50%" height="14px" />
                <Skeleton width="30%" height="12px" />
              </div>
              <Skeleton width="56px" height="22px" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton circle width="32px" height="32px" />
              <div className="flex-1 space-y-1">
                <Skeleton width="45%" height="14px" />
                <Skeleton width="25%" height="12px" />
              </div>
              <Skeleton width="56px" height="22px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function OrganigrammeTab({ units, members, loading }: Props) {
  if (loading) return <OrganigrammeSkeleton />;

  if (units.length === 0 && members.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
        <Building2 size={32} className="mx-auto text-[var(--text-faint)]" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Aucun pôle créé.</p>
      </div>
    );
  }

  const tree = buildTree(units);

  const unassignedMembers = members.filter((m) => !m.organizationUnit);

  return (
    <div className="space-y-3">
      {/* Unit tree */}
      {tree.map((node) => (
        <UnitNode key={node.id} node={node} members={members} depth={0} />
      ))}

      {/* Unassigned members */}
      {unassignedMembers.length > 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <Users size={16} className="text-[var(--text-faint)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--text-secondary)] flex-1">
              Membres sans pôle
            </span>
            <Badge variant="neutral">
              <Users size={12} />
              {unassignedMembers.length}
            </Badge>
          </div>
          <div className="border-t border-[var(--border)] px-3 py-2 space-y-0.5">
            {unassignedMembers.map((m) => (
              <MemberRow key={m.membershipId} member={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
