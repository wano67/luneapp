import { PDFDocument } from 'pdf-lib';
import { buildQuotePdf } from '@/server/pdf/quotePdf';
import { buildInvoicePdf } from '@/server/pdf/invoicePdf';
import { buildBalancePdf, buildGrandLivrePdf } from '@/server/pdf/accountingReportPdf';

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

  const balancePdf = await buildBalancePdf({
    businessName: 'Studio Lune',
    from: new Date('2026-01-01').toISOString(),
    to: new Date('2026-01-31').toISOString(),
    rows: [
      {
        accountCode: '706',
        accountName: 'Prestations de services',
        totalDebitCents: 0,
        totalCreditCents: 250000,
        soldeDebiteurCents: 0,
        soldeCrediteurCents: 250000,
      },
      {
        accountCode: '512',
        accountName: 'Banque',
        totalDebitCents: 1250000,
        totalCreditCents: 0,
        soldeDebiteurCents: 1250000,
        soldeCrediteurCents: 0,
      },
    ],
    totalDebitCents: 1250000,
    totalCreditCents: 250000,
  });

  if (!balancePdf || balancePdf.length < 500) {
    throw new Error('Balance PDF too small or empty.');
  }
  await PDFDocument.load(balancePdf);

  const grandLivrePdf = await buildGrandLivrePdf({
    businessName: 'Studio Lune',
    from: new Date('2026-01-01').toISOString(),
    to: new Date('2026-01-31').toISOString(),
    accounts: [
      {
        accountCode: '512',
        accountName: 'Banque',
        totalDebitCents: 1250000,
        totalCreditCents: 250000,
        lines: [
          {
            date: new Date('2026-01-05').toISOString(),
            journalCode: 'BQ',
            pieceRef: 'RELEVE-001',
            memo: `Operation bancaire ${weirdAmount}`,
            debitCents: 1250000,
            creditCents: 0,
          },
          {
            date: new Date('2026-01-12').toISOString(),
            journalCode: 'VE',
            pieceRef: 'FAC-2026-001',
            memo: 'Encaissement client',
            debitCents: 0,
            creditCents: 250000,
          },
        ],
      },
    ],
  });

  if (!grandLivrePdf || grandLivrePdf.length < 500) {
    throw new Error('Grand livre PDF too small or empty.');
  }
  await PDFDocument.load(grandLivrePdf);

  console.log('PDF sanitize test: OK');
}

main().catch((err) => {
  console.error('PDF sanitize test failed.');
  console.error(err);
  process.exit(1);
});
