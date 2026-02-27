import { prisma } from '@/server/db/client';
import { hasPermission, isAdminRole } from '@/server/auth/permissions';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, forbidden, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { BusinessPermission, Prisma } from '@/generated/prisma';

type BusinessRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

function parseId(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

function isValidRole(role: unknown): role is BusinessRole {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER';
}

function isAdmin(actorRole: BusinessRole) {
  return actorRole === 'ADMIN' || actorRole === 'OWNER';
}

function actorCanManageRole(actorRole: BusinessRole, targetRole: BusinessRole, nextRole: BusinessRole) {
  if (!isAdmin(actorRole)) return false;
  if (nextRole === 'OWNER') return false;
  if (targetRole === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  const manageable = targetRole === 'MEMBER' || targetRole === 'VIEWER';
  const nextAllowed = nextRole === 'MEMBER' || nextRole === 'VIEWER';
  return manageable && nextAllowed;
}

function actorCanRemove(actorRole: BusinessRole, targetRole: BusinessRole) {
  if (!isAdmin(actorRole)) return false;
  if (targetRole === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  return targetRole === 'MEMBER' || targetRole === 'VIEWER';
}

type MembershipWithProfile = Prisma.BusinessMembershipGetPayload<{
  include: {
    user: { select: { email: true; name: true } };
    employeeProfile: true;
    permissions: true;
    organizationUnit: { select: { id: true; name: true } };
  };
}>;

function serializeMember(membership: MembershipWithProfile | null) {
  if (!membership) return null;
  return {
    membershipId: membership.id.toString(),
    userId: membership.userId.toString(),
    email: membership.user?.email ?? '',
    name: membership.user?.name ?? null,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    organizationUnit: membership.organizationUnit
      ? { id: membership.organizationUnit.id.toString(), name: membership.organizationUnit.name }
      : null,
    employeeProfile: membership.employeeProfile
      ? {
          id: membership.employeeProfile.id.toString(),
          jobTitle: membership.employeeProfile.jobTitle,
          contractType: membership.employeeProfile.contractType,
          startDate: membership.employeeProfile.startDate
            ? membership.employeeProfile.startDate.toISOString()
            : null,
          endDate: membership.employeeProfile.endDate ? membership.employeeProfile.endDate.toISOString() : null,
          weeklyHours: membership.employeeProfile.weeklyHours,
          hourlyCostCents: membership.employeeProfile.hourlyCostCents
            ? membership.employeeProfile.hourlyCostCents.toString()
            : null,
          status: membership.employeeProfile.status,
          notes: membership.employeeProfile.notes,
          createdAt: membership.employeeProfile.createdAt.toISOString(),
          updatedAt: membership.employeeProfile.updatedAt.toISOString(),
        }
      : null,
    permissions: membership.permissions?.map((p) => p.permission) ?? [],
  };
}

// GET /api/pro/businesses/{businessId}/members/{userId}
export const GET = withBusinessRoute<{ businessId: string; userId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const targetUserId = parseId(params.userId);
    if (!targetUserId) return withIdNoStore(badRequest('userId invalide.'), requestId);

    const targetMembership = (await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
      include: {
        user: { select: { email: true, name: true } },
        employeeProfile: true,
        permissions: true,
        organizationUnit: { select: { id: true, name: true } },
      },
    })) as MembershipWithProfile | null;

    if (!targetMembership) return withIdNoStore(notFound('Membre introuvable.'), requestId);

    return jsonb({ item: serializeMember(targetMembership) }, requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/members/{userId}
export const PATCH = withBusinessRoute<{ businessId: string; userId: string }>(
  { minRole: 'VIEWER', rateLimit: { key: (ctx) => `pro:members:update:${ctx.businessId}:${ctx.userId}`, limit: 120, windowMs: 60 * 60 * 1000 } },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const targetUserId = parseId(params.userId);
    if (!targetUserId) return withIdNoStore(badRequest('userId invalide.'), requestId);

    const targetMembership = (await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
      include: {
        user: { select: { email: true, name: true } },
        employeeProfile: true,
        permissions: true,
        organizationUnit: { select: { id: true, name: true } },
      },
    })) as MembershipWithProfile | null;
    if (!targetMembership) {
      return withIdNoStore(notFound('Membre introuvable.'), requestId);
    }

    if (targetMembership.businessId !== businessIdBigInt) {
      return withIdNoStore(notFound('Membre introuvable.'), requestId);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const roleRaw = (body as { role?: unknown }).role;
    const wantsRoleChange = roleRaw !== undefined;
    const wantsProfileUpdate = typeof (body as { employeeProfile?: unknown }).employeeProfile === 'object';
    const wantsPermissionsUpdate = Array.isArray((body as { permissions?: unknown }).permissions);

    if (!wantsRoleChange && !wantsProfileUpdate && !wantsPermissionsUpdate) {
      return withIdNoStore(badRequest('Aucun champ valide fourni.'), requestId);
    }

    const actorWithPerms = (await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: ctx.userId } },
      include: { permissions: true },
    })) as MembershipWithProfile | null;
    if (!actorWithPerms) return withIdNoStore(forbidden(), requestId);

    const actorRole = ctx.membership.role as BusinessRole;
    const canEditProfile = hasPermission(actorWithPerms, BusinessPermission.TEAM_EDIT);

    let nextRole: BusinessRole | null = null;
    if (wantsRoleChange) {
      if (!isValidRole(roleRaw)) return withIdNoStore(badRequest('Rôle invalide.'), requestId);
      nextRole = roleRaw;
      if (!actorCanManageRole(actorRole, targetMembership.role as BusinessRole, nextRole)) {
        return withIdNoStore(forbidden(), requestId);
      }
      if (nextRole === targetMembership.role) {
        nextRole = null;
      }
    }

    if (wantsProfileUpdate && !canEditProfile && !isAdminRole(actorRole)) {
      return withIdNoStore(forbidden(), requestId);
    }

    if (targetMembership.userId === ctx.userId && wantsRoleChange) {
      if (!wantsProfileUpdate && !wantsPermissionsUpdate && nextRole && nextRole !== targetMembership.role) {
        return withIdNoStore(badRequest('Impossible de modifier ton propre rôle.'), requestId);
      }
      nextRole = null;
    }

    const profilePayload = (body as { employeeProfile?: Record<string, unknown> }).employeeProfile ?? {};
    const permissionsPayload = (body as { permissions?: string[] }).permissions ?? [];

    const profileData: Record<string, unknown> = {};
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v === null ? null : undefined);
    const num = (v: unknown) =>
      v === null
        ? null
        : typeof v === 'number' && Number.isFinite(v)
          ? Math.trunc(v)
          : typeof v === 'string' && v.trim()
            ? Number(v)
            : undefined;
    const date = (v: unknown) => {
      if (v === null) return null;
      if (typeof v === 'string' && v.trim()) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d;
      }
      return undefined;
    };
    const big = (v: unknown) => {
      if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
      if (typeof v === 'string' && v.trim() && /^\d+$/.test(v.trim())) return BigInt(v.trim());
      if (v === null) return null;
      return undefined;
    };

    if (wantsProfileUpdate) {
      const jobTitle = str(profilePayload.jobTitle);
      if (jobTitle !== undefined) profileData.jobTitle = jobTitle || null;

      const contractType = str(profilePayload.contractType);
      if (contractType !== undefined) profileData.contractType = contractType || null;

      const startDate = date(profilePayload.startDate);
      if (startDate !== undefined) profileData.startDate = startDate;
      const endDate = date(profilePayload.endDate);
      if (endDate !== undefined) profileData.endDate = endDate;

      const weeklyHours = num(profilePayload.weeklyHours);
      if (weeklyHours !== undefined) profileData.weeklyHours = weeklyHours;

      const hourlyCost = big(profilePayload.hourlyCostCents);
      if (hourlyCost !== undefined) profileData.hourlyCostCents = hourlyCost;

      const statusRaw = profilePayload.status;
      if (statusRaw !== undefined) {
        if (statusRaw !== 'ACTIVE' && statusRaw !== 'INACTIVE') {
          return withIdNoStore(badRequest('Status invalide.'), requestId);
        }
        profileData.status = statusRaw;
      }

      const notes = str(profilePayload.notes);
      if (notes !== undefined) profileData.notes = notes || null;
    }

    let permissionsValidated: BusinessPermission[] | null = null;
    if (wantsPermissionsUpdate) {
      const values: BusinessPermission[] = [];
      for (const p of permissionsPayload) {
        if (typeof p !== 'string' || !Object.values(BusinessPermission).includes(p as BusinessPermission)) {
          return withIdNoStore(badRequest('Permission invalide.'), requestId);
        }
        values.push(p as BusinessPermission);
      }
      permissionsValidated = values;
      if (!isAdmin(actorRole)) {
        return withIdNoStore(forbidden(), requestId);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (nextRole) {
        await tx.businessMembership.update({
          where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
          data: { role: nextRole },
        });
      }

      if (Object.keys(profileData).length > 0) {
        await tx.employeeProfile.upsert({
          where: { membershipId: targetMembership.id },
          update: profileData,
          create: { membershipId: targetMembership.id, ...profileData },
        });
      }

      if (permissionsValidated) {
        await tx.businessMemberPermission.deleteMany({ where: { membershipId: targetMembership.id } });
        if (permissionsValidated.length) {
          await tx.businessMemberPermission.createMany({
            data: permissionsValidated.map((permission) => ({
              membershipId: targetMembership.id,
              permission,
            })),
          });
        }
      }

      return tx.businessMembership.findUnique({
        where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
        include: {
          user: { select: { email: true, name: true } },
          employeeProfile: true,
          permissions: true,
          organizationUnit: { select: { id: true, name: true } },
        },
      });
    });

    return jsonb({ item: serializeMember(updated as MembershipWithProfile | null) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/members/{userId}
export const DELETE = withBusinessRoute<{ businessId: string; userId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:members:delete:${ctx.businessId}:${ctx.userId}`, limit: 60, windowMs: 60 * 60 * 1000 } },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const targetUserId = parseId(params.userId);
    if (!targetUserId) return withIdNoStore(badRequest('userId invalide.'), requestId);

    const targetMembership = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
      include: { user: { select: { email: true } } },
    });
    if (!targetMembership || targetMembership.businessId !== businessIdBigInt) {
      return withIdNoStore(notFound('Membre introuvable.'), requestId);
    }

    if (targetMembership.userId === ctx.userId) {
      return withIdNoStore(badRequest('Impossible de te retirer via cette action.'), requestId);
    }

    const actorRole = ctx.membership.role as BusinessRole;
    if (!actorCanRemove(actorRole, targetMembership.role as BusinessRole)) {
      return withIdNoStore(forbidden(), requestId);
    }

    await prisma.businessMembership.delete({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
    });

    return jsonbNoContent(requestId);
  }
);
