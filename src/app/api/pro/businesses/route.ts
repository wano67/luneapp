import { prisma } from '@/server/db/client';
import type { BusinessRole } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson } from '@/server/http/apiUtils';
import { normalizeWebsiteUrl } from '@/lib/normalizeWebsiteUrl';
import { COUNTRIES, CURRENCIES } from '@/lib/constants/geo';
import { normalizeSiret, isValidSiret, normalizeVat, isValidVat } from '@/lib/validation/siret';

// GET /api/pro/businesses
export const GET = withPersonalRoute(async (ctx) => {
  const memberships = await prisma.businessMembership.findMany({
    where: { userId: ctx.userId },
    include: { business: true },
  });

  const items = memberships.map((membership) => ({
    business: membership.business,
    role: membership.role,
  }));

  return jsonb({ items }, ctx.requestId);
});

// POST /api/pro/businesses
export const POST = withPersonalRoute(async (ctx, req) => {
  const body = await readJson(req) as Record<string, unknown> | null;

  if (!body || typeof body.name !== 'string') {
    return badRequest('Le nom de l\u2019entreprise est requis.');
  }

  const name = (body.name as string).trim();

  if (!name) {
    return badRequest('Le nom de l\u2019entreprise ne peut pas \u00eatre vide.');
  }

  const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : null;
  if (!countryCode || !COUNTRIES.some((c) => c.code === countryCode)) {
    return badRequest('Pays invalide.');
  }

  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'EUR';
  if (!CURRENCIES.some((c) => c.code === currency)) {
    return badRequest('Devise invalide.');
  }

  const vatEnabled = body.vatEnabled === true;
  const vatRatePercent =
    typeof body.vatRatePercent === 'number' && Number.isFinite(body.vatRatePercent)
      ? Math.max(0, Math.min(100, Math.trunc(body.vatRatePercent)))
      : 20;

  const siretRaw = typeof body.siret === 'string' ? normalizeSiret(body.siret) : '';
  if (siretRaw && !isValidSiret(siretRaw)) {
    return badRequest('SIRET invalide (14 chiffres + contr\u00f4le).');
  }

  const vatRaw = typeof body.vatNumber === 'string' ? normalizeVat(body.vatNumber) : '';
  if (vatRaw) {
    const vatResult = isValidVat(vatRaw, countryCode);
    if (!vatResult.ok) {
      return badRequest('Num\u00e9ro de TVA intracom invalide.');
    }
    if (countryCode === 'FR' && !vatRaw.startsWith('FR')) {
      return badRequest('TVA intracom FR attendue.');
    }
  }

  const websiteRaw = body.websiteUrl;
  const normalizedWebsite = await normalizeWebsiteUrl(websiteRaw);
  if (normalizedWebsite.error) {
    return badRequest(normalizedWebsite.error);
  }

  const legalName = typeof body.legalName === 'string' ? body.legalName.trim() || null : null;
  const addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() || null : null;
  const addressLine2 = typeof body.addressLine2 === 'string' ? body.addressLine2.trim() || null : null;
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null;
  const city = typeof body.city === 'string' ? body.city.trim() || null : null;
  const invoicePrefix = typeof body.invoicePrefix === 'string' && (body.invoicePrefix as string).trim().length ? (body.invoicePrefix as string).trim() : 'INV-';
  const quotePrefix = typeof body.quotePrefix === 'string' && (body.quotePrefix as string).trim().length ? (body.quotePrefix as string).trim() : 'DEV-';

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
      ownerId: ctx.userId,
      memberships: {
        create: {
          userId: ctx.userId,
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

  return jsonbCreated(
    {
      business,
      role: 'OWNER' as BusinessRole,
    },
    ctx.requestId
  );
});
