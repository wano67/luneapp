import { PDFDocument } from 'pdf-lib';
import { buildQuotePdf } from '@/server/pdf/quotePdf';
import { buildInvoicePdf } from '@/server/pdf/invoicePdf';

async function main() {
  const weirdAmount = '2\u202F500,00 €';
  const longLegalText = Array.from({ length: 45 })
    .map((_, idx) => `Clause ${idx + 1} : prestation longue description pour test multi-page.`)
    .join('\n');
  const longPrestations = Array.from({ length: 12 })
    .map((_, idx) => `Prestation ${idx + 1} : description détaillée du périmètre et des livrables.`)
    .join('\n');
  const longItems = Array.from({ length: 40 }).map((_, idx) => ({
    label: `Service ${idx + 1} ${weirdAmount}`,
    description: 'Description détaillée de la prestation avec plusieurs mots pour forcer le retour à la ligne.',
    quantity: 1,
    unitPriceCents: 200000,
    originalUnitPriceCents: 250000,
    unitLabel: '/mois',
    billingUnit: 'MONTHLY',
    totalCents: 200000,
  }));
  const quotePdf = await buildQuotePdf({
    quoteId: '123',
    number: 'SF-DEV-2026-0001',
    businessName: 'Studio Lune',
    business: {
      legalName: 'Studio Lune SAS',
      addressLine1: '10 rue des Lilas',
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',
      siret: '123 456 789 00010',
      vatNumber: 'FR123456789',
      websiteUrl: 'https://lune.app',
      iban: 'FR7630001000102679233217',
      bic: 'REVOFRP2',
      cgvText: longLegalText,
      paymentTermsText: 'Paiement à 30 jours.',
      lateFeesText: 'Pénalités de retard : 3x le taux légal.',
      fixedIndemnityText: 'Indemnité forfaitaire de 40€ pour frais de recouvrement.',
      legalMentionsText: 'TVA non applicable - article 293B du CGI.',
    },
    client: {
      name: 'Client Exemple',
      companyName: 'Client & Co',
      address: '5 avenue de la République, 75011 Paris',
      email: 'client@example.com',
      phone: '+33 6 00 00 00 00',
    },
    projectName: 'Projet Démo',
    prestationsText: longPrestations,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    depositPercent: 30,
    totalCents: 250000,
    depositCents: 75000,
    balanceCents: 175000,
    currency: 'EUR',
    vatEnabled: true,
    vatRatePercent: 20,
    paymentTermsDays: 30,
    note: `Montant indicatif : ${weirdAmount}`,
    items: longItems,
  });

  if (!quotePdf || quotePdf.length < 500) {
    throw new Error('Quote PDF too small or empty.');
  }
  const quoteDoc = await PDFDocument.load(quotePdf);
  if (quoteDoc.getPageCount() < 3) {
    throw new Error('Quote PDF should be multi-page (prestations + CGV).');
  }

  const invoicePdf = await buildInvoicePdf({
    invoiceId: '456',
    number: 'SF-FAC-2026-0001',
    businessName: 'Studio Lune',
    business: {
      legalName: 'Studio Lune SAS',
      addressLine1: '10 rue des Lilas',
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',
      siret: '123 456 789 00010',
      vatNumber: 'FR123456789',
      websiteUrl: 'https://lune.app',
      iban: 'FR7630001000102679233217',
      bic: 'REVOFRP2',
      cgvText: longLegalText,
      paymentTermsText: 'Paiement à 30 jours.',
      lateFeesText: 'Pénalités de retard : 3x le taux légal.',
      fixedIndemnityText: 'Indemnité forfaitaire de 40€ pour frais de recouvrement.',
      legalMentionsText: 'TVA non applicable - article 293B du CGI.',
    },
    client: {
      name: 'Client Exemple',
      companyName: 'Client & Co',
      address: '5 avenue de la République, 75011 Paris',
      email: 'client@example.com',
      phone: '+33 6 00 00 00 00',
    },
    projectName: 'Projet Démo',
    prestationsText: longPrestations,
    issuedAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    paidAt: null,
    totalCents: 250000,
    depositCents: 75000,
    balanceCents: 175000,
    currency: 'EUR',
    vatEnabled: true,
    vatRatePercent: 20,
    paymentTermsDays: 30,
    note: `Facture : ${weirdAmount}`,
    items: longItems,
  });

  if (!invoicePdf || invoicePdf.length < 500) {
    throw new Error('Invoice PDF too small or empty.');
  }
  const invoiceDoc = await PDFDocument.load(invoicePdf);
  if (invoiceDoc.getPageCount() < 2) {
    throw new Error('Invoice PDF should be multi-page.');
  }

  console.log('PDF sanitize test: OK');
}

main().catch((err) => {
  console.error('PDF sanitize test failed.');
  console.error(err);
  process.exit(1);
});
