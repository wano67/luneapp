import type { ClientSnapshot, IssuerSnapshot } from '@/server/billing/snapshots';

export type InvoiceComplianceSeverity = 'error' | 'warning' | 'info';

export type InvoiceComplianceIssue = {
  code: string;
  severity: InvoiceComplianceSeverity;
  label: string;
  detail: string;
};

export type InvoiceComplianceReport = {
  checkedAt: string;
  isCompliant: boolean;
  required: {
    total: number;
    completed: number;
  };
  recommended: {
    total: number;
    completed: number;
  };
  issues: InvoiceComplianceIssue[];
};

type InvoiceComplianceInput = {
  invoice: {
    number?: string | null;
    issuedAt?: Date | string | null;
    dueAt?: Date | string | null;
    itemsCount?: number;
    vatEnabled?: boolean | null;
    paymentTermsDays?: number | null;
  };
  issuer?: IssuerSnapshot | null;
  client?: ClientSnapshot | null;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasIssuerAddress(issuer: IssuerSnapshot | null | undefined): boolean {
  if (!issuer) return false;
  const hasMainLine = hasText(issuer.addressLine1);
  const hasLocality = hasText(issuer.postalCode) || hasText(issuer.city) || hasText(issuer.countryCode);
  return hasMainLine && hasLocality;
}

function hasClientAddress(client: ClientSnapshot | null | undefined): boolean {
  if (!client) return false;
  const hasStructured = hasText(client.addressLine1) && (hasText(client.postalCode) || hasText(client.city));
  return hasStructured || hasText(client.address);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasVatExemptionMention(issuer: IssuerSnapshot | null | undefined): boolean {
  if (!issuer) return false;
  const text = normalizeText(
    [issuer.legalText, issuer.billingLegalText, issuer.legalMentionsText].filter(Boolean).join('\n')
  );
  return text.includes('tva non applicable') || text.includes('293 b');
}

export function assessInvoiceCompliance(input: InvoiceComplianceInput): InvoiceComplianceReport {
  const { invoice, issuer, client } = input;
  const issues: InvoiceComplianceIssue[] = [];

  let requiredTotal = 0;
  let requiredCompleted = 0;
  let recommendedTotal = 0;
  let recommendedCompleted = 0;

  const checkRequired = (ok: boolean, issue: InvoiceComplianceIssue) => {
    requiredTotal += 1;
    if (ok) {
      requiredCompleted += 1;
      return;
    }
    issues.push(issue);
  };

  const checkRecommended = (ok: boolean, issue: InvoiceComplianceIssue) => {
    recommendedTotal += 1;
    if (ok) {
      recommendedCompleted += 1;
      return;
    }
    issues.push(issue);
  };

  checkRequired(hasText(invoice.number), {
    code: 'invoice_number_missing',
    severity: 'error',
    label: 'Numéro de facture',
    detail: 'La facture doit avoir un numéro unique chronologique.',
  });
  checkRequired(invoice.issuedAt != null, {
    code: 'invoice_issued_at_missing',
    severity: 'error',
    label: 'Date d’émission',
    detail: 'La date d’émission est obligatoire.',
  });
  checkRequired(invoice.dueAt != null, {
    code: 'invoice_due_at_missing',
    severity: 'error',
    label: 'Date de règlement',
    detail: 'La date limite de paiement doit figurer sur la facture.',
  });
  checkRequired((invoice.itemsCount ?? 0) > 0, {
    code: 'invoice_lines_missing',
    severity: 'error',
    label: 'Lignes de facturation',
    detail: 'Au moins une ligne détaillée est nécessaire (désignation, quantité, prix).',
  });
  checkRequired(hasText(issuer?.legalName), {
    code: 'issuer_identity_missing',
    severity: 'error',
    label: 'Identité vendeur/prestataire',
    detail: 'Renseigne la raison sociale/nom de l’émetteur.',
  });
  checkRequired(hasIssuerAddress(issuer), {
    code: 'issuer_address_missing',
    severity: 'error',
    label: 'Adresse émetteur',
    detail: 'L’adresse complète de l’émetteur est requise.',
  });
  checkRequired(hasText(issuer?.siret), {
    code: 'issuer_siret_missing',
    severity: 'error',
    label: 'SIRET/SIREN émetteur',
    detail: 'Un identifiant d’immatriculation doit figurer sur la facture.',
  });
  checkRequired(hasText(client?.companyName) || hasText(client?.name), {
    code: 'client_identity_missing',
    severity: 'error',
    label: 'Identité client',
    detail: 'Le nom ou la dénomination sociale du client est manquant.',
  });
  checkRequired(hasClientAddress(client), {
    code: 'client_address_missing',
    severity: 'error',
    label: 'Adresse client',
    detail: 'L’adresse du client (ou de facturation) est manquante.',
  });

  checkRecommended(hasText(issuer?.lateFeesText), {
    code: 'late_fees_missing',
    severity: 'warning',
    label: 'Pénalités de retard',
    detail: 'Ajoute le taux/les modalités des pénalités de retard.',
  });
  checkRecommended(hasText(issuer?.fixedIndemnityText), {
    code: 'fixed_indemnity_missing',
    severity: 'warning',
    label: 'Indemnité forfaitaire',
    detail: 'Ajoute la mention de l’indemnité forfaitaire de recouvrement (40 € en B2B).',
  });
  checkRecommended(hasText(issuer?.paymentTermsText) || invoice.paymentTermsDays != null, {
    code: 'payment_terms_missing',
    severity: 'warning',
    label: 'Conditions de règlement',
    detail: 'Précise explicitement les conditions de paiement (et escompte éventuel).',
  });
  checkRecommended(hasText(issuer?.email) || hasText(issuer?.phone), {
    code: 'issuer_contact_missing',
    severity: 'warning',
    label: 'Contact facturation',
    detail: 'Ajoute un email ou téléphone de contact facturation.',
  });
  checkRecommended(hasText(issuer?.iban) && hasText(issuer?.bic), {
    code: 'bank_details_missing',
    severity: 'warning',
    label: 'Coordonnées bancaires',
    detail: 'IBAN/BIC améliorent la lisibilité et la rapidité de paiement.',
  });

  const vatEnabled = input.invoice.vatEnabled === true;
  if (vatEnabled) {
    checkRecommended(hasText(issuer?.vatNumber), {
      code: 'issuer_vat_number_missing',
      severity: 'warning',
      label: 'Numéro TVA vendeur',
      detail: 'Le numéro de TVA du vendeur est attendu sur les factures soumises à TVA.',
    });
    checkRecommended(hasText(client?.vatNumber), {
      code: 'client_vat_number_missing',
      severity: 'info',
      label: 'Numéro TVA client',
      detail: 'En B2B, renseigne le numéro de TVA client quand il est redevable.',
    });
  } else {
    checkRecommended(hasVatExemptionMention(issuer), {
      code: 'vat_exemption_mention_missing',
      severity: 'warning',
      label: 'Mention TVA non applicable',
      detail: 'Si vous êtes en franchise en base, ajoute la mention légale (ex: art. 293 B CGI).',
    });
  }

  checkRecommended(hasText(client?.reference), {
    code: 'purchase_order_reference_missing',
    severity: 'info',
    label: 'Référence client / bon de commande',
    detail: 'Ajoute la référence client quand elle existe.',
  });

  issues.push({
    code: 'future_2026_mandatory_mentions',
    severity: 'info',
    label: 'Réforme e-facturation 2026/2027',
    detail:
      'Prépare les nouvelles mentions (SIREN client, adresse de livraison, nature des opérations, option débits si concerné).',
  });

  const hasError = issues.some((issue) => issue.severity === 'error');

  return {
    checkedAt: new Date().toISOString(),
    isCompliant: !hasError,
    required: {
      total: requiredTotal,
      completed: requiredCompleted,
    },
    recommended: {
      total: recommendedTotal,
      completed: recommendedCompleted,
    },
    issues,
  };
}
