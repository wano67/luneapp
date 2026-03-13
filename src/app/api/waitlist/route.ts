import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { sendWaitlistConfirmationEmail } from '@/server/services/email';

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'waitlist'),
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  const referralCode =
    typeof body?.referralCode === 'string' ? body.referralCode.trim() : undefined;

  let isNew = true;
  try {
    await prisma.waitlistEntry.create({
      data: {
        email,
        ...(referralCode ? { referredByCode: referralCode } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      isNew = false;
    } else {
      console.error('[waitlist] DB error:', err instanceof Error ? err.message : 'unknown');
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
  }

  if (isNew) {
    await sendWaitlistConfirmationEmail({ to: email });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
