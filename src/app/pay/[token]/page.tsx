import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import { formatCents } from '@/lib/money';
import { hashToken } from '@/server/security/tokenHash';

type Props = { params: Promise<{ token: string }> };

export default async function PaymentPage({ params }: Props) {
  const { token } = await params;

  const link = await prisma.paymentLink.findUnique({
    where: { token: hashToken(token) },
    include: {
      business: { select: { name: true } },
      invoice: { select: { number: true } },
      client: { select: { name: true } },
    },
  });

  if (!link) return notFound();

  const isExpired = link.expiresAt && link.expiresAt < new Date();
  const isPaid = link.status === 'PAID';
  const isCancelled = link.status === 'CANCELLED';
  const isActive = link.status === 'ACTIVE' && !isExpired;

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">{link.business.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Lien de paiement</p>
        </div>

        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-gray-900">
            {formatCents(link.amountCents)}
          </div>
          {link.description && (
            <p className="text-sm text-gray-600">{link.description}</p>
          )}
          {link.invoice?.number && (
            <p className="text-xs text-gray-400">Facture {link.invoice.number}</p>
          )}
          {link.client?.name && (
            <p className="text-xs text-gray-400">{link.client.name}</p>
          )}
        </div>

        {isPaid && (
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-green-700 font-medium">Paiement effectué</p>
            {link.paidAt && (
              <p className="text-xs text-green-600 mt-1">
                Le {new Date(link.paidAt).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        )}

        {isCancelled && (
          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-700 font-medium">Lien annulé</p>
          </div>
        )}

        {isExpired && !isPaid && (
          <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-yellow-700 font-medium">Lien expiré</p>
          </div>
        )}

        {isActive && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 text-center">
              Le paiement en ligne sera bientôt disponible via Stripe.
              Contactez {link.business.name} pour régler par virement ou carte.
            </p>
            {link.expiresAt && (
              <p className="text-xs text-gray-400 text-center">
                Expire le {new Date(link.expiresAt).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-400">Propulsé par Lune</p>
        </div>
      </div>
    </div>
  );
}
