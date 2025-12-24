import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function forbidden(requestId: string) {
  return withNoStore(withRequestId(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), requestId));
}

// POST /api/pro/businesses/{businessId}/prospects/{prospectId}/convert
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; prospectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId, prospectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const prospectIdBigInt = parseId(prospectId);
  if (!businessIdBigInt || !prospectIdBigInt) return withRequestId(badRequest('Ids invalides.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

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
  if (!prospect) {
    return withRequestId(NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 }), requestId);
  }

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
      data: {
        status: 'WON',
        pipelineStatus: 'CLOSED',
      },
    });

    return { clientId: ensuredClient.id, projectId: createdProject.id };
  });

  return withNoStore(
    withRequestId(
      NextResponse.json(
        {
          clientId: result.clientId.toString(),
          projectId: result.projectId.toString(),
        },
        { status: 200 }
      ),
      requestId
    )
  );
}
