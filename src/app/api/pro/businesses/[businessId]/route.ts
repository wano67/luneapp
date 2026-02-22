import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { normalizeWebsiteUrl } from '@/lib/normalizeWebsiteUrl';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function serializeBusiness(business: {
  id: bigint;
  name: string;
  websiteUrl: string | null;
  legalName: string | null;
  siret: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  billingEmail: string | null;
  billingPhone: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  accountHolder: string | null;
  billingLegalText: string | null;
  ownerId: bigint;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: business.id.toString(),
    name: business.name,
    websiteUrl: business.websiteUrl,
    legalName: business.legalName,
    siret: business.siret,
    vatNumber: business.vatNumber,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    postalCode: business.postalCode,
    city: business.city,
    countryCode: business.countryCode,
    billingEmail: business.billingEmail,
    billingPhone: business.billingPhone,
    iban: business.iban,
    bic: business.bic,
    bankName: business.bankName,
    accountHolder: business.accountHolder,
    billingLegalText: business.billingLegalText,
    ownerId: business.ownerId.toString(),
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const business = await prisma.business.findUnique({
    where: { id: businessIdBigInt },
  });

  if (!business) {
    return withRequestId(notFound('Entreprise introuvable.'), requestId);
  }

  return withRequestId(
    jsonNoStore({
      ...serializeBusiness(business),
      role: membership.role,
    }),
    requestId
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const { businessId: businessIdParam } = await context.params;
  const businessIdBigInt = parseId(businessIdParam);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'OWNER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(notFound('Entreprise introuvable.'), requestId);
  }

  await prisma.$transaction([
    prisma.businessInvite.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.businessMembership.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.prospect.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.client.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.project.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.business.delete({ where: { id: businessIdBigInt } }),
  ]);

  return withRequestId(NextResponse.json({ deleted: true }), requestId);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withRequestId(csrf, requestId);

  const { businessId: businessIdParam } = await context.params;
  const businessIdBigInt = parseId(businessIdParam);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:business:update:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withRequestId(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withRequestId(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (typeof (body as Record<string, unknown>).name !== 'string') {
      return withRequestId(badRequest('Nom invalide.'), requestId);
    }
    const name = (body as Record<string, unknown>).name?.toString().trim();
    if (!name) return withRequestId(badRequest('Nom requis.'), requestId);
    if (name.length > 200) return withRequestId(badRequest('Nom trop long (200 max).'), requestId);
    data.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'websiteUrl')) {
    const normalizedWebsite = await normalizeWebsiteUrl((body as Record<string, unknown>).websiteUrl);
    if (normalizedWebsite.error) {
      return withRequestId(badRequest(normalizedWebsite.error), requestId);
    }
    data.websiteUrl = normalizedWebsite.value;
  }

  const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : null);

  if (Object.prototype.hasOwnProperty.call(body, 'legalName')) {
    const legalName = readString((body as Record<string, unknown>).legalName);
    if (legalName && legalName.length > 200) {
      return withRequestId(badRequest('Raison sociale trop longue (200 max).'), requestId);
    }
    data.legalName = legalName || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'siret')) {
    const siret = readString((body as Record<string, unknown>).siret);
    if (siret && siret.length > 40) {
      return withRequestId(badRequest('SIRET trop long (40 max).'), requestId);
    }
    data.siret = siret || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'vatNumber')) {
    const vatNumber = readString((body as Record<string, unknown>).vatNumber);
    if (vatNumber && vatNumber.length > 40) {
      return withRequestId(badRequest('Numéro de TVA trop long (40 max).'), requestId);
    }
    data.vatNumber = vatNumber || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'addressLine1')) {
    const addressLine1 = readString((body as Record<string, unknown>).addressLine1);
    if (addressLine1 && addressLine1.length > 200) {
      return withRequestId(badRequest('Adresse ligne 1 trop longue (200 max).'), requestId);
    }
    data.addressLine1 = addressLine1 || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'addressLine2')) {
    const addressLine2 = readString((body as Record<string, unknown>).addressLine2);
    if (addressLine2 && addressLine2.length > 200) {
      return withRequestId(badRequest('Adresse ligne 2 trop longue (200 max).'), requestId);
    }
    data.addressLine2 = addressLine2 || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'postalCode')) {
    const postalCode = readString((body as Record<string, unknown>).postalCode);
    if (postalCode && postalCode.length > 20) {
      return withRequestId(badRequest('Code postal trop long (20 max).'), requestId);
    }
    data.postalCode = postalCode || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'city')) {
    const city = readString((body as Record<string, unknown>).city);
    if (city && city.length > 100) {
      return withRequestId(badRequest('Ville trop longue (100 max).'), requestId);
    }
    data.city = city || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'countryCode')) {
    const countryCode = readString((body as Record<string, unknown>).countryCode);
    if (countryCode && countryCode.length !== 2) {
      return withRequestId(badRequest('countryCode doit être un code ISO à 2 lettres.'), requestId);
    }
    if (countryCode) data.countryCode = countryCode.toUpperCase();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'billingEmail')) {
    const billingEmail = readString((body as Record<string, unknown>).billingEmail);
    if (billingEmail && billingEmail.length > 200) {
      return withRequestId(badRequest('Email de facturation trop long (200 max).'), requestId);
    }
    data.billingEmail = billingEmail || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'billingPhone')) {
    const billingPhone = readString((body as Record<string, unknown>).billingPhone);
    if (billingPhone && billingPhone.length > 40) {
      return withRequestId(badRequest('Téléphone de facturation trop long (40 max).'), requestId);
    }
    data.billingPhone = billingPhone || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'iban')) {
    const iban = readString((body as Record<string, unknown>).iban);
    if (iban && iban.length > 64) {
      return withRequestId(badRequest('IBAN trop long (64 max).'), requestId);
    }
    data.iban = iban || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'bic')) {
    const bic = readString((body as Record<string, unknown>).bic);
    if (bic && bic.length > 32) {
      return withRequestId(badRequest('BIC trop long (32 max).'), requestId);
    }
    data.bic = bic || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'bankName')) {
    const bankName = readString((body as Record<string, unknown>).bankName);
    if (bankName && bankName.length > 120) {
      return withRequestId(badRequest('Nom de banque trop long (120 max).'), requestId);
    }
    data.bankName = bankName || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'accountHolder')) {
    const accountHolder = readString((body as Record<string, unknown>).accountHolder);
    if (accountHolder && accountHolder.length > 120) {
      return withRequestId(badRequest('Titulaire du compte trop long (120 max).'), requestId);
    }
    data.accountHolder = accountHolder || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'billingLegalText')) {
    const billingLegalText = readString((body as Record<string, unknown>).billingLegalText);
    if (billingLegalText && billingLegalText.length > 2000) {
      return withRequestId(badRequest('Mentions légales trop longues (2000 max).'), requestId);
    }
    data.billingLegalText = billingLegalText || null;
  }

  if (Object.keys(data).length === 0) {
    return withRequestId(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.business.update({
    where: { id: businessIdBigInt },
    data,
  });

  return withRequestId(jsonNoStore({ item: serializeBusiness(updated) }), requestId);
}
