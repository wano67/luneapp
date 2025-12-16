import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

type Body = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

const MIN_PASSWORD_LENGTH = 8;

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const limited = rateLimit(req, {
    key: `account:password:${userId}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body: Body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return withRequestId(badRequest('Mot de passe actuel et nouveau mot de passe requis.'), requestId);
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return withRequestId(badRequest('Le mot de passe doit contenir au moins 8 caractères.'), requestId);
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { passwordHash: true },
  });

  if (!user) {
    return withRequestId(unauthorized(), requestId);
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return withRequestId(NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 }), requestId);
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { passwordHash: newHash },
  });

  return jsonNoStore({ ok: true });
}
