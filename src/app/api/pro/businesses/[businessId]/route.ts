import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore } from '@/server/security/csrf';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

async function getUserId(request: NextRequest): Promise<bigint | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) return null;
    return BigInt(payload.sub);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return badRequest('businessId invalide.');

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const membership = await requireBusinessRole(businessIdBigInt, userId, 'VIEWER');
  if (!membership) return forbidden();

  const business = await prisma.business.findUnique({
    where: { id: businessIdBigInt },
  });

  if (!business) {
    return NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 });
  }

  return jsonNoStore({
    id: business.id.toString(),
    name: business.name,
    ownerId: business.ownerId.toString(),
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  });
}
