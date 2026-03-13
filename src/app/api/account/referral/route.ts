import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const limited = rateLimit(req, {
    key: `account:referral:${userId}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { referralCode: true, name: true },
  });

  if (!user) return withRequestId(unauthorized(), requestId);

  let referralCode = user.referralCode;

  // Generate referral code if user doesn't have one: PRENOM-XXXX
  if (!referralCode) {
    const firstName = (user.name ?? '').split(/\s+/)[0] || 'PIVOT';
    const cleanName = firstName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 10);
    const hex = crypto.randomBytes(2).toString('hex').toUpperCase();
    referralCode = `${cleanName}-${hex}`;

    await prisma.user.update({
      where: { id: BigInt(userId) },
      data: { referralCode },
    });
  }

  // Count referrals (users who registered with this user as referrer)
  const [referralCount, referrals] = await Promise.all([
    prisma.user.count({ where: { referredById: BigInt(userId) } }),
    prisma.user.findMany({
      where: { referredById: BigInt(userId) },
      select: { name: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // Also count waitlist entries with this code
  const waitlistCount = await prisma.waitlistEntry.count({
    where: { referredByCode: referralCode },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pivotapp.fr';
  const referralLink = `${baseUrl}/waitlist?ref=${encodeURIComponent(referralCode)}`;

  return withRequestId(
    jsonNoStore({
      referralCode,
      referralLink,
      referralCount: referralCount + waitlistCount,
      registeredCount: referralCount,
      waitlistCount,
      referrals: referrals.map((r) => ({
        name: r.name ? maskName(r.name) : 'Utilisateur',
        createdAt: r.createdAt.toISOString(),
      })),
    }),
    requestId,
  );
}

/** Mask a name for privacy: "Marie Dupont" → "M. D." */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => `${p[0]?.toUpperCase() ?? ''}.`).join(' ');
}
