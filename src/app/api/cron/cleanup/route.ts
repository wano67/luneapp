import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { localFileExists } from '@/server/storage/local';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/cleanup — RGPD data retention cleanup.
 * Protected by CRON_SECRET header.
 *
 * Schedule: daily via Railway cron or external cron service.
 * curl -X POST https://diwanbg.work/api/cron/cleanup -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const results: Record<string, number> = {};

  // 1. Expired refresh tokens (> 7 days past expiry)
  const expiredTokens = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: ninetyDaysAgo } },
  });
  results.expiredRefreshTokens = expiredTokens.count;

  // 2. Revoked/expired share tokens older than 1 year
  const oldShareTokens = await prisma.projectShareToken.deleteMany({
    where: {
      OR: [
        { revokedAt: { lt: oneYearAgo } },
        { expiresAt: { lt: oneYearAgo } },
      ],
    },
  });
  results.oldShareTokens = oldShareTokens.count;

  // 3. Revoked calendar tokens older than 1 year
  const oldCalTokens = await prisma.calendarToken.deleteMany({
    where: { revokedAt: { lt: oneYearAgo } },
  });
  results.oldCalendarTokens = oldCalTokens.count;

  const oldPersonalCalTokens = await prisma.personalCalendarToken.deleteMany({
    where: { revokedAt: { lt: oneYearAgo } },
  });
  results.oldPersonalCalendarTokens = oldPersonalCalTokens.count;

  // 4. Read notifications older than 90 days
  const oldNotifications = await prisma.notification.deleteMany({
    where: { isRead: true, createdAt: { lt: ninetyDaysAgo } },
  });
  results.oldNotifications = oldNotifications.count;

  // 5. Expired email verification tokens
  const expiredVerifications = await prisma.user.updateMany({
    where: {
      emailVerificationExpiry: { lt: ninetyDaysAgo },
      emailVerificationToken: { not: null },
    },
    data: {
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });
  results.expiredVerificationTokens = expiredVerifications.count;

  // 6. Expired password reset tokens
  const expiredResets = await prisma.user.updateMany({
    where: {
      passwordResetExpiry: { lt: ninetyDaysAgo },
      passwordResetToken: { not: null },
    },
    data: {
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });
  results.expiredResetTokens = expiredResets.count;

  // 7. Orphan documents (file missing from storage) — batched
  const allDocs = await prisma.businessDocument.findMany({
    select: { id: true, storageKey: true },
    take: 5000,
  });
  const docChecks = await Promise.all(
    allDocs.map(async (doc) => ({ id: doc.id, exists: await localFileExists(doc.storageKey) }))
  );
  const orphanDocIds = docChecks.filter((d) => !d.exists).map((d) => d.id);
  if (orphanDocIds.length > 0) {
    await prisma.businessDocument.deleteMany({ where: { id: { in: orphanDocIds } } });
  }
  results.orphanDocuments = orphanDocIds.length;

  // 8. Orphan product images (file missing from storage) — batched
  const allImages = await prisma.productImage.findMany({
    select: { id: true, storageKey: true },
    take: 5000,
  });
  const imgChecks = await Promise.all(
    allImages.map(async (img) => ({ id: img.id, exists: await localFileExists(img.storageKey) }))
  );
  const orphanImgIds = imgChecks.filter((i) => !i.exists).map((i) => i.id);
  if (orphanImgIds.length > 0) {
    await prisma.productImage.deleteMany({ where: { id: { in: orphanImgIds } } });
  }
  results.orphanProductImages = orphanImgIds.length;

  return NextResponse.json({
    ok: true,
    cleanedAt: now.toISOString(),
    results,
  });
}
