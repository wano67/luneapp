import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { normalizeWebsiteUrl } from '@/lib/normalizeWebsiteUrl';

const businessSelect = {
  id: true,
  name: true,
  websiteUrl: true,
  legalName: true,
  siret: true,
  vatNumber: true,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  city: true,
  countryCode: true,
  billingEmail: true,
  billingPhone: true,
  iban: true,
  bic: true,
  bankName: true,
  accountHolder: true,
  billingLegalText: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET /api/pro/businesses/{businessId}
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: businessSelect,
    });

    if (!business) return notFound('Entreprise introuvable.');

    return jsonb(
      {
        ...business,
        role: ctx.membership.role,
      },
      ctx.requestId
    );
  }
);

// DELETE /api/pro/businesses/{businessId}
export const DELETE = withBusinessRoute(
  { minRole: 'OWNER' },
  async (ctx) => {
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId } });
    if (!business) return notFound('Entreprise introuvable.');

    await prisma.$transaction([
      prisma.businessInvite.deleteMany({ where: { businessId: ctx.businessId } }),
      prisma.businessMembership.deleteMany({ where: { businessId: ctx.businessId } }),
      prisma.prospect.deleteMany({ where: { businessId: ctx.businessId } }),
      prisma.client.deleteMany({ where: { businessId: ctx.businessId } }),
      prisma.project.deleteMany({ where: { businessId: ctx.businessId } }),
      prisma.business.delete({ where: { id: ctx.businessId } }),
    ]);

    return jsonb({ deleted: true }, ctx.requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}
export const PATCH = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:business:update:${ctx.businessId}:${ctx.userId}`, limit: 60, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, req) => {
    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const data: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      if (typeof (body as Record<string, unknown>).name !== 'string') {
        return badRequest('Nom invalide.');
      }
      const name = (body as Record<string, unknown>).name?.toString().trim();
      if (!name) return badRequest('Nom requis.');
      if (name.length > 200) return badRequest('Nom trop long (200 max).');
      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'websiteUrl')) {
      const normalizedWebsite = await normalizeWebsiteUrl((body as Record<string, unknown>).websiteUrl);
      if (normalizedWebsite.error) {
        return badRequest(normalizedWebsite.error);
      }
      data.websiteUrl = normalizedWebsite.value;
    }

    const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : null);

    if (Object.prototype.hasOwnProperty.call(body, 'legalName')) {
      const legalName = readString((body as Record<string, unknown>).legalName);
      if (legalName && legalName.length > 200) {
        return badRequest('Raison sociale trop longue (200 max).');
      }
      data.legalName = legalName || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'siret')) {
      const siret = readString((body as Record<string, unknown>).siret);
      if (siret && siret.length > 40) {
        return badRequest('SIRET trop long (40 max).');
      }
      data.siret = siret || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'vatNumber')) {
      const vatNumber = readString((body as Record<string, unknown>).vatNumber);
      if (vatNumber && vatNumber.length > 40) {
        return badRequest('Numéro de TVA trop long (40 max).');
      }
      data.vatNumber = vatNumber || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'addressLine1')) {
      const addressLine1 = readString((body as Record<string, unknown>).addressLine1);
      if (addressLine1 && addressLine1.length > 200) {
        return badRequest('Adresse ligne 1 trop longue (200 max).');
      }
      data.addressLine1 = addressLine1 || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'addressLine2')) {
      const addressLine2 = readString((body as Record<string, unknown>).addressLine2);
      if (addressLine2 && addressLine2.length > 200) {
        return badRequest('Adresse ligne 2 trop longue (200 max).');
      }
      data.addressLine2 = addressLine2 || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'postalCode')) {
      const postalCode = readString((body as Record<string, unknown>).postalCode);
      if (postalCode && postalCode.length > 20) {
        return badRequest('Code postal trop long (20 max).');
      }
      data.postalCode = postalCode || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'city')) {
      const city = readString((body as Record<string, unknown>).city);
      if (city && city.length > 100) {
        return badRequest('Ville trop longue (100 max).');
      }
      data.city = city || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'countryCode')) {
      const countryCode = readString((body as Record<string, unknown>).countryCode);
      if (countryCode && countryCode.length !== 2) {
        return badRequest('countryCode doit être un code ISO à 2 lettres.');
      }
      if (countryCode) data.countryCode = countryCode.toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'billingEmail')) {
      const billingEmail = readString((body as Record<string, unknown>).billingEmail);
      if (billingEmail && billingEmail.length > 200) {
        return badRequest('Email de facturation trop long (200 max).');
      }
      data.billingEmail = billingEmail || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'billingPhone')) {
      const billingPhone = readString((body as Record<string, unknown>).billingPhone);
      if (billingPhone && billingPhone.length > 40) {
        return badRequest('Téléphone de facturation trop long (40 max).');
      }
      data.billingPhone = billingPhone || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'iban')) {
      const iban = readString((body as Record<string, unknown>).iban);
      if (iban && iban.length > 64) {
        return badRequest('IBAN trop long (64 max).');
      }
      data.iban = iban || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'bic')) {
      const bic = readString((body as Record<string, unknown>).bic);
      if (bic && bic.length > 32) {
        return badRequest('BIC trop long (32 max).');
      }
      data.bic = bic || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'bankName')) {
      const bankName = readString((body as Record<string, unknown>).bankName);
      if (bankName && bankName.length > 120) {
        return badRequest('Nom de banque trop long (120 max).');
      }
      data.bankName = bankName || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'accountHolder')) {
      const accountHolder = readString((body as Record<string, unknown>).accountHolder);
      if (accountHolder && accountHolder.length > 120) {
        return badRequest('Titulaire du compte trop long (120 max).');
      }
      data.accountHolder = accountHolder || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'billingLegalText')) {
      const billingLegalText = readString((body as Record<string, unknown>).billingLegalText);
      if (billingLegalText && billingLegalText.length > 2000) {
        return badRequest('Mentions légales trop longues (2000 max).');
      }
      data.billingLegalText = billingLegalText || null;
    }

    if (Object.keys(data).length === 0) {
      return badRequest('Aucune modification.');
    }

    const updated = await prisma.business.update({
      where: { id: ctx.businessId },
      data,
      select: businessSelect,
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);
