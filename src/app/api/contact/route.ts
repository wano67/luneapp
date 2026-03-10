import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'contact'),
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.name !== 'string' ||
    typeof body.email !== 'string' ||
    typeof body.subject !== 'string' ||
    typeof body.message !== 'string'
  ) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const subject = body.subject.trim();
  const message = body.message.trim();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Veuillez remplir tous les champs.' }, { status: 400 });
  }

  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message trop long (max 5000 caracteres).' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY not set');
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Lune <noreply@lune.app>';
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'diwan@test.fr';

  try {
    await resend.emails.send({
      from: fromAddress,
      to: adminEmail,
      replyTo: email,
      subject: `[Contact Lune] ${subject}`,
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:18px;color:#111;margin:0 0 16px;">Nouveau message de contact</h1>
    <table style="font-size:14px;color:#555;line-height:1.6;border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#111;">Nom</td><td>${escapeHtml(name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#111;">Email</td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#111;">Sujet</td><td>${escapeHtml(subject)}</td></tr>
    </table>
    <hr style="margin:16px 0;border:none;border-top:1px solid #e5e5e5;" />
    <p style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact] Failed to send:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Erreur lors de l\'envoi.' }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
