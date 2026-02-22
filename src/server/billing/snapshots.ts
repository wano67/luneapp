type IssuerSnapshotInput = {
  name: string;
  legalName?: string | null;
  websiteUrl?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  billingLegalText?: string | null;
  cgvText?: string | null;
  paymentTermsText?: string | null;
  lateFeesText?: string | null;
  fixedIndemnityText?: string | null;
  legalMentionsText?: string | null;
};

export type IssuerSnapshot = {
  legalName?: string | null;
  websiteUrl?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  legalText?: string | null;
  billingLegalText?: string | null;
  cgvText?: string | null;
  paymentTermsText?: string | null;
  lateFeesText?: string | null;
  fixedIndemnityText?: string | null;
  legalMentionsText?: string | null;
};

type ClientSnapshotInput = {
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  billingCompanyName?: string | null;
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingVatNumber?: string | null;
  billingReference?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingCountryCode?: string | null;
};

export type ClientSnapshot = {
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  reference?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
};

export function buildIssuerSnapshot(business: IssuerSnapshotInput): IssuerSnapshot {
  const legalParts = [
    business.billingLegalText,
    business.cgvText,
    business.paymentTermsText,
    business.lateFeesText,
    business.fixedIndemnityText,
    business.legalMentionsText,
  ].filter((part) => typeof part === 'string' && part.trim().length > 0) as string[];
  const legalText = legalParts.length ? legalParts.join('\n') : null;
  return {
    legalName: business.legalName || business.name || null,
    websiteUrl: business.websiteUrl ?? null,
    siret: business.siret ?? null,
    vatNumber: business.vatNumber ?? null,
    addressLine1: business.addressLine1 ?? null,
    addressLine2: business.addressLine2 ?? null,
    postalCode: business.postalCode ?? null,
    city: business.city ?? null,
    countryCode: business.countryCode ?? null,
    email: business.billingEmail ?? null,
    phone: business.billingPhone ?? null,
    iban: business.iban ?? null,
    bic: business.bic ?? null,
    bankName: business.bankName ?? null,
    accountHolder: business.accountHolder ?? null,
    legalText,
    billingLegalText: business.billingLegalText ?? null,
    cgvText: business.cgvText ?? null,
    paymentTermsText: business.paymentTermsText ?? null,
    lateFeesText: business.lateFeesText ?? null,
    fixedIndemnityText: business.fixedIndemnityText ?? null,
    legalMentionsText: business.legalMentionsText ?? null,
  };
}

export function buildClientSnapshot(client: ClientSnapshotInput | null | undefined): ClientSnapshot | null {
  if (!client) return null;
  return {
    name: client.billingContactName ?? client.name ?? null,
    companyName: client.billingCompanyName ?? client.companyName ?? null,
    email: client.billingEmail ?? client.email ?? null,
    phone: client.billingPhone ?? client.phone ?? null,
    vatNumber: client.billingVatNumber ?? null,
    reference: client.billingReference ?? null,
    address: client.address ?? null,
    addressLine1: client.billingAddressLine1 ?? null,
    addressLine2: client.billingAddressLine2 ?? null,
    postalCode: client.billingPostalCode ?? null,
    city: client.billingCity ?? null,
    countryCode: client.billingCountryCode ?? null,
  };
}

export function coerceIssuerSnapshot(value: unknown): IssuerSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  return value as IssuerSnapshot;
}

export function coerceClientSnapshot(value: unknown): ClientSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  return value as ClientSnapshot;
}
