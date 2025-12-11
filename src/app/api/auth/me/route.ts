import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { toPublicUser } from '@/server/auth/auth.service';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serializeBusiness(b: any) {
  return {
    id: b.id.toString(),
    name: b.name,
    ownerId: b.ownerId.toString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return unauthorized();
  }

  try {
    const { payload } = await verifyAuthToken(token);
    const sub = payload.sub;

    if (!sub) {
      return unauthorized();
    }

    const userId = BigInt(sub);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        businessMemberships: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return unauthorized();
    }

    const memberships = user.businessMemberships.map((membership) => ({
      business: serializeBusiness(membership.business),
      role: membership.role,
    }));

    return NextResponse.json({
      user: toPublicUser(user),
      memberships,
    });
  } catch (error) {
    console.error('Error in /api/auth/me', error);
    return unauthorized();
  }
}
