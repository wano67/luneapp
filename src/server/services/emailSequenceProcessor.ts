import { prisma } from '@/server/db/client';
import { Resend } from 'resend';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Process pending email sequence sends.
 * Called by cron job — processes all sends where scheduledAt <= now and status = PENDING.
 */
export async function processEmailSequenceSends(): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return 0;

  const resend = new Resend(apiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Lune <noreply@lune.app>';

  const pendingSends = await prisma.emailSequenceSend.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: new Date() },
    },
    include: {
      sequence: { select: { subject: true, body: true, status: true, business: { select: { name: true } } } },
    },
    take: 50,
    orderBy: { scheduledAt: 'asc' },
  });

  let sentCount = 0;

  for (const send of pendingSends) {
    // Skip if sequence was deactivated
    if (send.sequence.status !== 'ACTIVE') {
      await prisma.emailSequenceSend.update({
        where: { id: send.id },
        data: { status: 'CANCELLED' },
      });
      continue;
    }

    try {
      const subject = send.sequence.subject
        .replace('{name}', send.recipientName ?? '')
        .replace('{business}', send.sequence.business.name);

      const body = send.sequence.body
        .replace('{name}', escapeHtml(send.recipientName ?? ''))
        .replace('{business}', escapeHtml(send.sequence.business.name));

      const escapedBizName = escapeHtml(send.sequence.business.name);

      const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    ${body.split('\n').map((line) => `<p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 12px;">${escapeHtml(line)}</p>`).join('\n    ')}
    <p style="color:#888;font-size:11px;margin:24px 0 0;">
      Envoy&eacute; par ${escapedBizName} via Lune.
    </p>
  </div>
</body>
</html>`;

      await resend.emails.send({
        from: fromAddress,
        to: send.recipientEmail,
        subject,
        html,
      });

      await prisma.emailSequenceSend.update({
        where: { id: send.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      sentCount++;
    } catch (err) {
      await prisma.emailSequenceSend.update({
        where: { id: send.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
        },
      });
    }
  }

  return sentCount;
}
