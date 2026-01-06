import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import type { Business, BusinessRole } from '@/generated/prisma';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { badRequest, getErrorMessage, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { normalizeWebsiteUrl } from '@/lib/normalizeWebsiteUrl';
import { COUNTRIES, CURRENCIES } from '@/lib/constants/geo';
import { normalizeSiret, isValidSiret, normalizeVat, isValidVat } from '@/lib/validation/siret';

function serializeBusiness(b: Business) {
  return {
    id: b.id.toString(),
    name: b.name,
    websiteUrl: b.websiteUrl,
    countryCode: (b as Business & { countryCode?: string }).countryCode,
    legalName: (b as Business & { legalName?: string }).legalName,
    vatNumber: (b as Business & { vatNumber?: string }).vatNumber,
    siret: (b as Business & { siret?: string }).siret,
    addressLine1: (b as Business & { addressLine1?: string }).addressLine1,
    addressLine2: (b as Business & { addressLine2?: string }).addressLine2,
    postalCode: (b as Business & { postalCode?: string }).postalCode,
    city: (b as Business & { city?: string }).city,
    ownerId: b.ownerId.toString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses
// -> liste des entreprises de l'utilisateur
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  try {
    const memberships = await prisma.businessMembership.findMany({
      where: { userId: BigInt(userId) },
      include: { business: true },
    });

    const items = memberships.map((membership) => ({
      business: serializeBusiness(membership.business as Business),
      role: membership.role,
    }));

    return withRequestId(jsonNoStore({ items }), requestId);
  } catch (error) {
    console.error({ requestId, route: '/api/pro/businesses', error });
    return withRequestId(
      NextResponse.json({ error: 'Impossible de charger les entreprises.' }, { status: 500 }),
      requestId
    );
  }
}

// POST /api/pro/businesses
// -> crée une entreprise et membership OWNER
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:businesses:create:${userId.toString()}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== 'string') {
    return withRequestId(badRequest('Le nom de l’entreprise est requis.'), requestId);
  }

  const name = body.name.trim();

  if (!name) {
    return withRequestId(badRequest('Le nom de l’entreprise ne peut pas être vide.'), requestId);
  }

  const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : null;
  if (!countryCode || !COUNTRIES.some((c) => c.code === countryCode)) {
    return withRequestId(badRequest('Pays invalide.'), requestId);
  }

  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'EUR';
  if (!CURRENCIES.some((c) => c.code === currency)) {
    return withRequestId(badRequest('Devise invalide.'), requestId);
  }

  const vatEnabled = body.vatEnabled === true;
  const vatRatePercent =
    typeof body.vatRatePercent === 'number' && Number.isFinite(body.vatRatePercent)
      ? Math.max(0, Math.min(100, Math.trunc(body.vatRatePercent)))
      : 20;

  const siretRaw = typeof body.siret === 'string' ? normalizeSiret(body.siret) : '';
  if (siretRaw && !isValidSiret(siretRaw)) {
    return withRequestId(badRequest('SIRET invalide (14 chiffres + contrôle).'), requestId);
  }

  const vatRaw = typeof body.vatNumber === 'string' ? normalizeVat(body.vatNumber) : '';
  if (vatRaw) {
    const vatResult = isValidVat(vatRaw, countryCode);
    if (!vatResult.ok) {
      return withRequestId(badRequest('Numéro de TVA intracom invalide.'), requestId);
    }
    if (countryCode === 'FR' && !vatRaw.startsWith('FR')) {
      return withRequestId(badRequest('TVA intracom FR attendue.'), requestId);
    }
  }

  const websiteRaw = (body as Record<string, unknown>).websiteUrl;
  const normalizedWebsite = await normalizeWebsiteUrl(websiteRaw);
  if (normalizedWebsite.error) {
    return withRequestId(badRequest(normalizedWebsite.error), requestId);
  }

  const legalName = typeof body.legalName === 'string' ? body.legalName.trim() || null : null;
  const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() || null : null;
  const addressLine2 = typeof body.addressLine2 === 'string' ? body.addressLine2.trim() || null : null;
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null;
  const city = typeof body.city === 'string' ? body.city.trim() || null : null;
  const invoicePrefix = typeof body.invoicePrefix === 'string' && body.invoicePrefix.trim().length ? body.invoicePrefix.trim() : 'INV-';
  const quotePrefix = typeof body.quotePrefix === 'string' && body.quotePrefix.trim().length ? body.quotePrefix.trim() : 'DEV-';

  try {
    const business = await prisma.business.create({
      data: {
        name,
        websiteUrl: normalizedWebsite.value ?? undefined,
        legalName: legalName ?? undefined,
        countryCode,
        siret: siretRaw || undefined,
        vatNumber: vatRaw || undefined,
        addressLine1: addressLine1 ?? undefined,
        addressLine2: addressLine2 ?? undefined,
        postalCode: postalCode ?? undefined,
        city: city ?? undefined,
        ownerId: BigInt(userId),
        memberships: {
          create: {
            userId: BigInt(userId),
            role: 'OWNER' as BusinessRole,
          },
        },
        settings: {
          create: {
            currency,
            vatEnabled,
            vatRatePercent,
            invoicePrefix,
            quotePrefix,
          },
        },
      },
    });

    return withRequestId(
      jsonNoStore(
        {
          business: serializeBusiness(business),
          role: 'OWNER' as BusinessRole,
        },
        { status: 201 }
      ),
      requestId
    );
  } catch (error) {
    console.error({ requestId, route: '/api/pro/businesses', error: getErrorMessage(error) });
    return withRequestId(
      NextResponse.json({ error: 'Impossible de créer l’entreprise.' }, { status: 500 }),
      requestId
    );
  }
}
