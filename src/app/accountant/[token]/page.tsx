import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { hashToken } from '@/server/security/tokenHash';

type Props = { params: Promise<{ token: string }> };

export default async function AccountantPortalPage({ params }: Props) {
  const { token } = await params;

  const access = await prisma.accountantAccess.findUnique({
    where: { token: hashToken(token) },
  });

  if (!access) return notFound();

  const isRevoked = !!access.revokedAt;
  const isExpired = access.expiresAt ? access.expiresAt < new Date() : false;

  if (isRevoked || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-[var(--danger)]">
            {isRevoked ? 'Accès révoqué' : 'Accès expiré'}
          </h1>
          <p className="text-[var(--text-faint)]">
            {isRevoked
              ? 'L\'accès à ce portail a été révoqué par le propriétaire de l\'entreprise.'
              : 'L\'accès à ce portail a expiré. Contactez le propriétaire pour renouveler.'}
          </p>
        </div>
      </div>
    );
  }

  // Fetch business info separately
  const business = await prisma.business.findUnique({
    where: { id: access.businessId },
    select: { name: true, siret: true },
  });

  // Update last access
  await prisma.accountantAccess.update({
    where: { id: access.id },
    data: { lastAccessAt: new Date() },
  });

  return (
    <div className="min-h-screen bg-[var(--background)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Portail Expert-Comptable</h1>
            <p className="text-[var(--text-faint)]">
              {business?.name ?? 'Entreprise'}
              {business?.siret && ` — SIRET ${business.siret}`}
            </p>
          </div>
          <span className="text-sm px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            {access.accessLevel === 'READ_WRITE' ? 'Lecture/Écriture' : 'Lecture seule'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-[var(--text-faint)]">Écritures comptables</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Chargez via l&apos;API</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-[var(--text-faint)]">Factures</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Chargez via l&apos;API</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-[var(--text-faint)]">Paiements</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Chargez via l&apos;API</p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold mb-4">Accès API</h2>
          <p className="text-sm text-[var(--text-faint)] mb-2">
            Utilisez ce token pour accéder aux données financières via l&apos;API :
          </p>
          <code className="block bg-[var(--background)] border border-[var(--border)] rounded p-3 text-sm font-mono break-all">
            GET /api/accountant/portal?token={token}
          </code>
          <p className="text-xs text-[var(--text-faint)] mt-2">
            Retourne les écritures, factures et paiements de l&apos;entreprise.
          </p>
        </div>
      </div>
    </div>
  );
}
