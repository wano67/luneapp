import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { badRequest, forbidden, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withNoStore(withRequestId(unauthorized(), requestId));
  }

  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withNoStore(withRequestId(badRequest('Identifiants invalides.'), requestId));
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withNoStore(withRequestId(notFound('Entreprise introuvable.'), requestId));
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withNoStore(withRequestId(forbidden(), requestId));

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
  });

  if (!client) {
    return withNoStore(withRequestId(notFound('Client introuvable.'), requestId));
  }

  return withNoStore(
    withRequestId(
      jsonNoStore({
        item: {
          id: client.id.toString(),
          businessId: client.businessId.toString(),
          name: client.name,
          email: client.email,
          phone: client.phone,
          notes: client.notes,
          sector: client.sector,
          status: client.status,
          leadSource: client.leadSource,
          createdAt: client.createdAt.toISOString(),
          updatedAt: client.updatedAt.toISOString(),
        },
      }),
      requestId
    )
  );
}
