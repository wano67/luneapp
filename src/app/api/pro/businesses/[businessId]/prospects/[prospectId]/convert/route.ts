import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';

// Null-returning ID parser pour les query params (comportement "soft" intentionnel)
function parseId(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

// POST /api/pro/businesses/{businessId}/prospects/{prospectId}/convert
export const POST = withBusinessRoute<{ businessId: string; prospectId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const prospectIdBigInt = parseId(params.prospectId);
    if (!prospectIdBigInt) return withIdNoStore(badRequest('prospectId invalide.'), requestId);

    const body = await request.json().catch(() => null);
    const existingClientId =
      isRecord(body) && typeof body.existingClientId === 'string' ? parseId(body.existingClientId) : null;
    const projectName =
      isRecord(body) && typeof body.projectName === 'string' && body.projectName.trim()
        ? body.projectName.trim()
        : null;

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectIdBigInt, businessId: businessIdBigInt },
    });
    if (!prospect) return withIdNoStore(notFound('Prospect introuvable.'), requestId);

    const client = existingClientId
      ? await prisma.client.findFirst({ where: { id: existingClientId, businessId: businessIdBigInt } })
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const ensuredClient =
        client ??
        (await tx.client.create({
          data: {
            businessId: businessIdBigInt,
            name: prospect.name,
            email: prospect.contactEmail ?? undefined,
            phone: prospect.contactPhone ?? undefined,
            notes: prospect.interestNote ?? undefined,
            status: 'ACTIVE',
            leadSource: prospect.source ?? undefined,
            sector: prospect.origin ?? undefined,
          },
        }));

      const createdProject = await tx.project.create({
        data: {
          businessId: businessIdBigInt,
          clientId: ensuredClient.id,
          name: projectName ?? prospect.projectIdea ?? prospect.name,
          status: 'PLANNED',
        },
      });

      await tx.prospect.update({
        where: { id: prospectIdBigInt },
        data: { status: 'WON', pipelineStatus: 'CLOSED' },
      });

      return { clientId: ensuredClient.id, projectId: createdProject.id };
    });

    return jsonb({
      clientId: result.clientId.toString(),
      projectId: result.projectId.toString(),
    }, requestId);
  }
);
