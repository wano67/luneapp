import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
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

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
  });
  if (!project) {
    return withRequestId(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);
  }

  const updated = await prisma.project.update({
    where: { id: projectIdBigInt },
    data: { archivedAt: null },
  });

  return withNoStore(
    withRequestId(
      NextResponse.json(
        {
          id: updated.id.toString(),
          archivedAt: updated.archivedAt ? updated.archivedAt.toISOString() : null,
        },
        { status: 200 }
      ),
      requestId
    )
  );
}
