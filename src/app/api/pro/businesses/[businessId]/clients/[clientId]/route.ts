import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { jsonNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

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

function serializeClient(client: {
  id: bigint;
  businessId: bigint;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: client.id.toString(),
    businessId: client.businessId.toString(),
    name: client.name,
    email: client.email,
    phone: client.phone,
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/clients/{clientId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, clientId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withRequestId(badRequest('businessId ou clientId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
  });

  if (!client) {
    return withRequestId(notFound('Client introuvable.'), requestId);
  }

  return jsonNoStore({ item: serializeClient(client) });
}
