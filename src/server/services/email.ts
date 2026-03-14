import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not set — emails will not be sent.');
    return null;
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
  VIEWER: 'Lecteur',
};

type InviteEmailParams = {
  to: string;
  businessName: string;
  inviterName: string | null;
  role: string;
  inviteLink: string;
  expiresAt: Date;
  userExists?: boolean;
};

export async function sendInviteEmail(params: InviteEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, businessName, inviterName, role, inviteLink, expiresAt, userExists } = params;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const expiryFormatted = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(expiresAt);

  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const inviterDisplay = inviterName || 'Un administrateur';

  const buttonLabel = userExists === false ? 'Cr&eacute;er mon compte' : 'Accepter l&apos;invitation';
  const instruction = userExists === false
    ? 'Cr&eacute;ez votre compte pour rejoindre l&apos;&eacute;quipe.'
    : 'Connectez-vous pour accepter l&apos;invitation.';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Invitation &agrave; rejoindre ${businessName}</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      ${inviterDisplay} vous invite &agrave; rejoindre <strong>${businessName}</strong> en tant que <strong>${roleLabel}</strong>.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${instruction}
    </p>
    <a href="${inviteLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      ${buttonLabel}
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      Ce lien expire le ${expiryFormatted}. Si vous n&apos;avez pas demand&eacute; cette invitation, ignorez cet email.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: `Invitation à rejoindre ${businessName} sur Pivot`,
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send invite email:', error instanceof Error ? error.message : 'unknown');
  }
}

type VerificationEmailParams = {
  to: string;
  name: string | null;
  verificationLink: string;
};

export async function sendVerificationEmail(params: VerificationEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, name, verificationLink } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const greeting = name ? `Bonjour ${name},` : 'Bonjour,';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Confirmez votre adresse email</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${greeting} merci de vous &ecirc;tre inscrit sur Pivot. Cliquez sur le bouton ci-dessous pour v&eacute;rifier votre adresse email.
    </p>
    <a href="${verificationLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      V&eacute;rifier mon email
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      Ce lien expire dans 24 heures. Si vous n&apos;avez pas cr&eacute;&eacute; de compte, ignorez cet email.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: 'Confirmez votre adresse email — Pivot',
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send verification email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── Password reset email ────────────────────────────────────────────────────

type PasswordResetEmailParams = {
  to: string;
  name: string | null;
  resetLink: string;
};

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, name, resetLink } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const greeting = name ? `Bonjour ${name},` : 'Bonjour,';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">R&eacute;initialisation de votre mot de passe</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${greeting} vous avez demand&eacute; &agrave; r&eacute;initialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </p>
    <a href="${resetLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      R&eacute;initialiser mon mot de passe
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      Ce lien expire dans 1 heure. Si vous n&apos;avez pas demand&eacute; cette r&eacute;initialisation, ignorez cet email.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: 'Réinitialisation de votre mot de passe — Pivot',
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send password reset email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── Project share email ────────────────────────────────────────────────────

type ProjectShareEmailParams = {
  to: string;
  businessName: string;
  projectName: string;
  shareLink: string;
  expiresAt: Date | null;
  hasPassword?: boolean;
};

export async function sendProjectShareEmail(params: ProjectShareEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, businessName, projectName, shareLink, expiresAt, hasPassword } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';

  const expiryLine = expiresAt
    ? `Ce lien expire le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(expiresAt)}.`
    : 'Ce lien reste valide jusqu&apos;&agrave; r&eacute;vocation.';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Suivi de votre projet</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      <strong>${businessName}</strong> vous donne acc&egrave;s au suivi de votre projet <strong>&laquo; ${projectName} &raquo;</strong>.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Consultez l&apos;avancement, les documents et la facturation en temps r&eacute;el.
    </p>
    <a href="${shareLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Voir mon projet
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      ${expiryLine}
    </p>${hasPassword ? `
    <p style="color:#888;font-size:12px;margin:8px 0 0;">
      Un mot de passe est requis pour acc&eacute;der &agrave; ce lien. Contactez votre prestataire pour l&apos;obtenir.
    </p>` : ''}
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: `${businessName} — Suivi de votre projet « ${projectName} »`,
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send project share email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── Quote email ───────────────────────────────────────────────────────────

type QuoteEmailParams = {
  to: string;
  businessName: string;
  projectName: string;
  quoteNumber: string | null;
  totalLabel: string;
  shareLink: string;
};

export async function sendQuoteEmail(params: QuoteEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, businessName, projectName, quoteNumber, totalLabel, shareLink } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const label = quoteNumber ? `devis ${quoteNumber}` : 'devis';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Votre ${label}</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      <strong>${businessName}</strong> vous a envoy&eacute; un ${label} pour le projet <strong>&laquo; ${projectName} &raquo;</strong>.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Montant : <strong>${totalLabel}</strong>
    </p>
    <a href="${shareLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Voir le devis
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      Vous pouvez consulter et signer ce devis depuis votre espace de suivi.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: `${businessName} — ${quoteNumber ? `Devis ${quoteNumber}` : 'Nouveau devis'} pour « ${projectName} »`,
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send quote email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── Invoice email ─────────────────────────────────────────────────────────

type InvoiceEmailParams = {
  to: string;
  businessName: string;
  projectName: string;
  invoiceNumber: string | null;
  totalLabel: string;
  dueAt: string | null;
  shareLink: string;
};

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, businessName, projectName, invoiceNumber, totalLabel, dueAt, shareLink } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const label = invoiceNumber ? `facture ${invoiceNumber}` : 'facture';

  const dueLine = dueAt
    ? `&Eacute;ch&eacute;ance : <strong>${dueAt}</strong>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Votre ${label}</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      <strong>${businessName}</strong> vous a envoy&eacute; une ${label} pour le projet <strong>&laquo; ${projectName} &raquo;</strong>.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 ${dueLine ? '8px' : '24px'};">
      Montant : <strong>${totalLabel}</strong>
    </p>
    ${dueLine ? `<p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">${dueLine}</p>` : ''}
    <a href="${shareLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Voir la facture
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      Consultez le d&eacute;tail de cette facture depuis votre espace de suivi.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: `${businessName} — ${invoiceNumber ? `Facture ${invoiceNumber}` : 'Nouvelle facture'} pour « ${projectName} »`,
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send invoice email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── E-invoice email ───────────────────────────────────────────────────────

type EInvoiceEmailParams = {
  to: string;
  businessName: string;
  projectName: string;
  invoiceNumber: string | null;
  totalLabel: string;
  shareLink: string;
};

export async function sendEInvoiceEmail(params: EInvoiceEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, businessName, projectName, invoiceNumber, totalLabel, shareLink } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const label = invoiceNumber ? `e-facture ${invoiceNumber}` : 'e-facture';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Votre ${label}</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      <strong>${businessName}</strong> vous a transmis une ${label} pour le projet <strong>&laquo; ${projectName} &raquo;</strong>.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Montant : <strong>${totalLabel}</strong>
    </p>
    <a href="${shareLink}"
       style="display:inline-block;padding:12px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Voir le projet
    </a>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">
      Consultez les d&eacute;tails depuis votre espace de suivi.
    </p>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: `${businessName} — ${invoiceNumber ? `E-facture ${invoiceNumber}` : 'Nouvelle e-facture'} pour « ${projectName} »`,
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send e-invoice email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── Waitlist confirmation email ────────────────────────────────────────────

type WaitlistConfirmationEmailParams = { to: string };

export async function sendWaitlistConfirmationEmail(params: WaitlistConfirmationEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Vous &ecirc;tes sur la liste !</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      Merci de votre int&eacute;r&ecirc;t pour <strong>Pivot</strong>. Votre place est r&eacute;serv&eacute;e.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      Nous pr&eacute;parons quelque chose de sp&eacute;cial pour vous aider &agrave; piloter votre activit&eacute; pro et vos finances perso depuis un seul endroit.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Vous recevrez un email d&egrave;s que votre acc&egrave;s sera pr&ecirc;t. &Agrave; tr&egrave;s bient&ocirc;t !
    </p>
    <div style="padding:16px;background:#f9f9f9;border-radius:8px;text-align:center;">
      <p style="color:#111;font-size:14px;font-weight:600;margin:0;">Pivot arrive bient&ocirc;t.</p>
      <p style="color:#888;font-size:12px;margin:4px 0 0;">Restez &agrave; l&apos;&eacute;coute.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: 'Pivot — Vous êtes sur la liste d\'attente !',
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send waitlist confirmation email:', error instanceof Error ? error.message : 'unknown');
  }
}

// ── Referral notification email ────────────────────────────────────────────

type ReferralNotificationEmailParams = {
  to: string;
  referrerName: string | null;
  refereeName: string;
};

export async function sendReferralNotificationEmail(params: ReferralNotificationEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, referrerName, refereeName } = params;
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || 'Pivot <noreply@pivotapp.fr>';
  const greeting = referrerName ? `Bonjour ${referrerName},` : 'Bonjour,';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5;">
    <h1 style="font-size:20px;color:#111;margin:0 0 8px;">Quelqu&apos;un a rejoint Pivot gr&acirc;ce &agrave; vous !</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px;">
      ${greeting} <strong>${refereeName}</strong> vient de s&apos;inscrire sur Pivot avec votre lien de parrainage.
    </p>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Continuez &agrave; partager votre lien pour grimper dans le classement !
    </p>
    <div style="padding:16px;background:#f9f9f9;border-radius:8px;text-align:center;">
      <p style="color:#111;font-size:14px;font-weight:600;margin:0;">Merci pour votre soutien.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: fromAddress,
      to,
      subject: 'Pivot — Un nouveau filleul a rejoint la liste !',
      html,
    });
  } catch (error) {
    console.error('[email] Failed to send referral notification email:', error instanceof Error ? error.message : 'unknown');
  }
}
