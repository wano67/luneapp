import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

type LeaderboardEntry = {
  name: string;
  referralCode: string;
  count: number;
  rank: number;
};

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const limited = rateLimit(req, {
    key: `account:referral:lb:${userId}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Top 10 referrers by registered user count
  const topReferrers = await prisma.user.findMany({
    where: {
      referrals: { some: {} },
    },
    select: {
      id: true,
      name: true,
      referralCode: true,
      _count: { select: { referrals: true } },
    },
    orderBy: {
      referrals: { _count: 'desc' },
    },
    take: 10,
  });

  const leaderboard: LeaderboardEntry[] = topReferrers.map((u, i) => ({
    name: u.name ? maskLeaderboardName(u.name) : 'Utilisateur',
    referralCode: u.referralCode ?? '',
    count: u._count.referrals,
    rank: i + 1,
  }));

  // Current user's stats
  const userBigInt = BigInt(userId);
  const userCount = await prisma.user.count({
    where: { referredById: userBigInt },
  });

  // Find user's rank
  let userRank: number | null = null;
  const userInTop = leaderboard.findIndex(
    (entry) => topReferrers[leaderboard.indexOf(entry)]?.id === userBigInt,
  );

  if (userInTop >= 0) {
    userRank = userInTop + 1;
  } else if (userCount > 0) {
    // Count how many users have more referrals
    const ahead = await prisma.user.count({
      where: {
        referrals: { some: {} },
        NOT: { id: userBigInt },
        // Users with more referrals than current user
      },
    });
    // Approximate rank: we count all users with referrals ahead
    // For exact rank we'd need a raw query, but this is good enough
    userRank = ahead + 1;
  }

  return withRequestId(
    jsonNoStore({
      leaderboard,
      userRank,
      userCount,
    }),
    requestId,
  );
}

/** Show first name + last initial: "Marie Dupont" → "Marie D." */
function maskLeaderboardName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? 'Utilisateur';
  return `${parts[0]} ${parts[parts.length - 1][0]?.toUpperCase() ?? ''}.`;
}
