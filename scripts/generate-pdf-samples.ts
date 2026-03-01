import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildQuotePdf } from '@/server/pdf/quotePdf';
import { buildInvoicePdf } from '@/server/pdf/invoicePdf';

const outDir = path.join(process.cwd(), 'tmp', 'pdf-samples');

function repeatParagraph(seed: string, repeat: number) {
  return Array.from({ length: repeat })
    .map((_, idx) => `${seed} ${idx + 1}. Cette phrase est volontairement longue pour tester le wrapping et la pagination propre.`)
    .join('\n\n');
}

function makeLongText(word: string, targetChars: number) {
  const chunk = `${word} `;
  let result = '';
  while (result.length < targetChars) result += chunk;
  return result.trim();
}

async function writePdf(name: string, bytes: Uint8Array) {
  const fullPath = path.join(outDir, name);
  await writeFile(fullPath, Buffer.from(bytes));
  const doc = await PDFDocument.load(bytes);
  return { fullPath, pages: doc.getPageCount(), size: bytes.length };
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const now = new Date();
  const in15Days = new Date(now.getTime() + 15 * 24 * 3600 * 1000);

  const commonBusiness = {
    legalName: 'Studio Lune Conseil',
    addressLine1: '10 rue des Lilas',
    addressLine2: 'Bâtiment A',
    postalCode: '75001',
    city: 'Paris',
    countryCode: 'FR',
    siret: '123 456 789 00010',
    vatNumber: 'FR12345678901',
    websiteUrl: 'https://lune.app',
    email: 'contact@lune.app',
    phone: '+33 1 00 00 00 00',
  };

  const commonClient = {
    companyName: 'Client & Fils',
    name: 'Marie Martin',
    addressLine1: '5 avenue de la République',
    postalCode: '69001',
    city: 'Lyon',
    countryCode: 'FR',
    email: 'marie.martin@example.com',
    phone: '+33 6 00 00 00 00',
  };

  const samples: Array<Promise<{ fullPath: string; pages: number; size: number }>> = [];

  // Cas 1: devis court (1 page)
  samples.push(
    (async () => {
      const pdf = await buildQuotePdf({
        quoteId: 'Q-CASE-1',
        number: 'DEV-2026-0001',
        businessName: commonBusiness.legalName,
        business: {
          ...commonBusiness,
          cgvText: null,
          paymentTermsText: null,
          legalMentionsText: null,
        },
        client: commonClient,
        projectName: 'Audit express identité visuelle',
        issuedAt: now.toISOString(),
        expiresAt: in15Days.toISOString(),
        totalCents: '150000',
        depositCents: '0',
        balanceCents: '150000',
        currency: 'EUR',
        vatEnabled: false,
        vatRatePercent: 0,
        paymentTermsDays: null,
        note: null,
        items: [
          {
            label: 'Audit de marque',
            description: 'Analyse du positionnement et recommandations prioritaires.',
            quantity: 1,
            unitPriceCents: '150000',
            totalCents: '150000',
          },
        ],
      });
      return writePdf('case-1-quote-short.pdf', pdf);
    })()
  );

  // Cas 2: devis avec descriptions longues (800+)
  samples.push(
    (async () => {
      const longDesc = makeLongText('Description détaillée', 950);
      const pdf = await buildQuotePdf({
        quoteId: 'Q-CASE-2',
        number: 'DEV-2026-0002',
        businessName: commonBusiness.legalName,
        business: {
          ...commonBusiness,
          cgvText: 'Paiement sous 30 jours. Pénalités de retard applicables.',
          paymentTermsText: 'Paiement sous 30 jours.',
          legalMentionsText: 'TVA applicable selon réglementation en vigueur.',
        },
        client: commonClient,
        projectName: 'Refonte plateforme et tunnel de conversion',
        issuedAt: now.toISOString(),
        expiresAt: in15Days.toISOString(),
        totalCents: '540000',
        depositCents: '162000',
        balanceCents: '378000',
        currency: 'EUR',
        vatEnabled: false,
        vatRatePercent: 0,
        paymentTermsDays: 30,
        note: 'Acompte de 30% à la signature.',
        items: [
          {
            label: 'Conception UX',
            description: longDesc,
            quantity: 1,
            unitPriceCents: '220000',
            totalCents: '220000',
          },
          {
            label: 'Développement',
            description: longDesc,
            quantity: 2,
            unitPriceCents: '160000',
            totalCents: '320000',
          },
        ],
      });
      return writePdf('case-2-quote-long-descriptions.pdf', pdf);
    })()
  );

  // Cas 3: CGV 8+ pages + mentions 3+ pages
  samples.push(
    (async () => {
      const cgv = repeatParagraph('Clause CGV', 420);
      const mentions = repeatParagraph('Mention légale', 140);
      const pdf = await buildQuotePdf({
        quoteId: 'Q-CASE-3',
        number: 'DEV-2026-0003',
        businessName: commonBusiness.legalName,
        business: {
          ...commonBusiness,
          cgvText: cgv,
          paymentTermsText: 'Paiement sous 45 jours. Virement SEPA.',
          lateFeesText: 'Le retard de paiement entraîne l’application de pénalités selon le taux légal majoré.',
          fixedIndemnityText: 'Indemnité forfaitaire de recouvrement de 40 euros due de plein droit.',
          legalMentionsText: mentions,
          billingLegalText: repeatParagraph('Mention complémentaire', 70),
        },
        client: commonClient,
        projectName: 'Mission annuelle d’accompagnement',
        issuedAt: now.toISOString(),
        expiresAt: in15Days.toISOString(),
        totalCents: '1250000',
        depositCents: '250000',
        balanceCents: '1000000',
        currency: 'EUR',
        vatEnabled: false,
        vatRatePercent: 0,
        paymentTermsDays: 45,
        note: 'Les annexes techniques sont décrites dans le contrat cadre.',
        items: [
          {
            label: 'Accompagnement stratégique',
            description: 'Pilotage mensuel, cadrage des priorités et revue de performance.',
            quantity: 10,
            unitPriceCents: '125000',
            totalCents: '1250000',
          },
        ],
      });
      return writePdf('case-3-quote-cgv-mentions-multipage.pdf', pdf);
    })()
  );

  // Cas 4: champs extrêmes + facture avec paiement partiel et TVA
  samples.push(
    (async () => {
      const veryLongName = makeLongText('NomClientTrèsLong', 220);
      const veryLongAddress = makeLongText('Adresse extrêmement détaillée avec plusieurs segments', 260);
      const veryLongEmail = `${makeLongText('email', 90).replace(/\s+/g, '')}@example.com`;

      const pdf = await buildInvoicePdf({
        invoiceId: 'I-CASE-4',
        number: 'FAC-2026-0004',
        businessName: makeLongText('StudioLuneBusinessName', 120),
        business: {
          ...commonBusiness,
          legalName: makeLongText('RaisonSocialeTrèsLongue', 140),
          addressLine1: veryLongAddress,
          addressLine2: veryLongAddress,
          email: veryLongEmail,
          cgvText: repeatParagraph('Clause standard', 40),
          paymentTermsText: 'Paiement sous 30 jours.',
          legalMentionsText: repeatParagraph('Mention', 30),
        },
        client: {
          ...commonClient,
          companyName: veryLongName,
          name: veryLongName,
          addressLine1: veryLongAddress,
          addressLine2: veryLongAddress,
          email: veryLongEmail,
        },
        projectName: 'Facturation finale projet multi-lots',
        issuedAt: now.toISOString(),
        dueAt: in15Days.toISOString(),
        paidAt: now.toISOString(),
        totalCents: '980000',
        depositCents: '250000',
        balanceCents: '330000',
        currency: 'EUR',
        vatEnabled: true,
        vatRatePercent: 20,
        paymentTermsDays: 30,
        note: 'Paiement partiel reçu, solde restant dû selon échéancier.',
        items: [
          {
            label: makeLongText('Développement lot fonctionnel', 170),
            description: makeLongText('Détail de prestation', 1000),
            quantity: 2,
            unitPriceCents: '240000',
            totalCents: '480000',
          },
          {
            label: makeLongText('Support et maintenance', 170),
            description: makeLongText('Description maintenance', 900),
            quantity: 5,
            unitPriceCents: '100000',
            totalCents: '500000',
          },
        ],
      });

      return writePdf('case-4-invoice-extreme-fields-vat-partial.pdf', pdf);
    })()
  );

  const results = await Promise.all(samples);

  console.log('PDF samples generated:');
  results.forEach((result) => {
    console.log(`- ${result.fullPath} | pages=${result.pages} | bytes=${result.size}`);
  });
}

main().catch((error) => {
  console.error('Failed to generate PDF samples.');
  console.error(error);
  process.exit(1);
});
