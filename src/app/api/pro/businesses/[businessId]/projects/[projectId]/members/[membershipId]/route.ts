import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}/members/{membershipId}
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string; membershipId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);
    const membershipId = parseId(params.membershipId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const targetMembership = await prisma.businessMembership.findFirst({
      where: { id: membershipId, businessId: ctx.businessId },
      select: { role: true },
    });
    if (!targetMembership) return notFound('Membre introuvable.');
    if (targetMembership.role === 'OWNER' || targetMembership.role === 'ADMIN') {
      return badRequest('Accès implicite pour les admins/owners.');
    }

    const existing = await prisma.projectMember.findFirst({
      where: { projectId, membershipId },
      select: { id: true },
    });
    if (!existing) return notFound('Accès introuvable.');

    await prisma.projectMember.delete({ where: { id: existing.id } });

    return jsonbNoContent(ctx.requestId);
  }
);
