import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { withIdNoStore } from '@/server/http/apiUtils';

// ---------------------------------------------------------------------------
// Serialisation (BigInt → string, Date → ISO)
// Les champs sont explicites pour éviter les fuites de données sensibles.
// ---------------------------------------------------------------------------

type SettingsRecord = Awaited<ReturnType<typeof getOrCreateSettings>>;

function serialize(s: SettingsRecord) {
  return {
    id: s.id.toString(),
    businessId: s.businessId.toString(),
    invoicePrefix: s.invoicePrefix,
    quotePrefix: s.quotePrefix,
    defaultDepositPercent: s.defaultDepositPercent,
    paymentTermsDays: s.paymentTermsDays,
    enableAutoNumbering: s.enableAutoNumbering,
    vatRatePercent: s.vatRatePercent,
    vatEnabled: s.vatEnabled,
    allowMembersInvite: s.allowMembersInvite,
    allowViewerExport: s.allowViewerExport,
    integrationStripeEnabled: s.integrationStripeEnabled,
    integrationStripePublicKey: s.integrationStripePublicKey,
    accountInventoryCode: s.accountInventoryCode,
    accountCogsCode: s.accountCogsCode,
    accountCashCode: s.accountCashCode,
    accountRevenueCode: s.accountRevenueCode,
    ledgerSalesAccountCode: s.ledgerSalesAccountCode,
    ledgerVatCollectedAccountCode: s.ledgerVatCollectedAccountCode,
    ledgerCashAccountCode: s.ledgerCashAccountCode,
    cgvText: s.cgvText ?? null,
    paymentTermsText: s.paymentTermsText ?? null,
    lateFeesText: s.lateFeesText ?? null,
    fixedIndemnityText: s.fixedIndemnityText ?? null,
    legalMentionsText: s.legalMentionsText ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function getOrCreateSettings(businessId: bigint) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });
}

// ---------------------------------------------------------------------------
// GET /api/pro/businesses/{businessId}/settings
// ---------------------------------------------------------------------------

export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const settings = await getOrCreateSettings(ctx.businessId);
  return jsonb({ item: serialize(settings) }, ctx.requestId);
});

// ---------------------------------------------------------------------------
// PATCH /api/pro/businesses/{businessId}/settings
// ---------------------------------------------------------------------------

export const PATCH = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:settings:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), ctx.requestId);
    }

    const data: Record<string, unknown> = {};
    const b = body as Record<string, unknown>;

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : null);
    const num = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.trunc(v)
        : typeof v === 'string' && v.trim()
          ? Number(v)
          : null;
    const bool = (v: unknown) => v === true || v === 'true';

    // Prefixes are fixed (SF-DEV / SF-FAC). Ignore updates to prevent mismatches.
    // const invoicePrefix = str(b.invoicePrefix);
    // const quotePrefix   = str(b.quotePrefix);

    const accountInventoryCode = str(b.accountInventoryCode);
    if (accountInventoryCode !== null) {
      if (!accountInventoryCode)
        return withIdNoStore(badRequest('accountInventoryCode requis.'), ctx.requestId);
      if (accountInventoryCode.length > 50)
        return withIdNoStore(badRequest('accountInventoryCode trop long (50 max).'), ctx.requestId);
      data.accountInventoryCode = accountInventoryCode;
    }

    const accountCogsCode = str(b.accountCogsCode);
    if (accountCogsCode !== null) {
      if (!accountCogsCode)
        return withIdNoStore(badRequest('accountCogsCode requis.'), ctx.requestId);
      if (accountCogsCode.length > 50)
        return withIdNoStore(badRequest('accountCogsCode trop long (50 max).'), ctx.requestId);
      data.accountCogsCode = accountCogsCode;
    }

    const accountCashCode = str(b.accountCashCode);
    if (accountCashCode !== null) {
      if (!accountCashCode)
        return withIdNoStore(badRequest('accountCashCode requis.'), ctx.requestId);
      if (accountCashCode.length > 50)
        return withIdNoStore(badRequest('accountCashCode trop long (50 max).'), ctx.requestId);
      data.accountCashCode = accountCashCode;
    }

    const accountRevenueCode = str(b.accountRevenueCode);
    if (accountRevenueCode !== null) {
      if (!accountRevenueCode)
        return withIdNoStore(badRequest('accountRevenueCode requis.'), ctx.requestId);
      if (accountRevenueCode.length > 50)
        return withIdNoStore(badRequest('accountRevenueCode trop long (50 max).'), ctx.requestId);
      data.accountRevenueCode = accountRevenueCode;
    }

    const ledgerSalesAccountCode = str(b.ledgerSalesAccountCode);
    if (ledgerSalesAccountCode !== null) {
      if (!ledgerSalesAccountCode)
        return withIdNoStore(badRequest('ledgerSalesAccountCode requis.'), ctx.requestId);
      if (ledgerSalesAccountCode.length > 50)
        return withIdNoStore(badRequest('ledgerSalesAccountCode trop long (50 max).'), ctx.requestId);
      data.ledgerSalesAccountCode = ledgerSalesAccountCode;
    }

    const ledgerVatCollectedAccountCode = str(b.ledgerVatCollectedAccountCode);
    if (ledgerVatCollectedAccountCode !== null) {
      if (!ledgerVatCollectedAccountCode)
        return withIdNoStore(badRequest('ledgerVatCollectedAccountCode requis.'), ctx.requestId);
      if (ledgerVatCollectedAccountCode.length > 50)
        return withIdNoStore(badRequest('ledgerVatCollectedAccountCode trop long (50 max).'), ctx.requestId);
      data.ledgerVatCollectedAccountCode = ledgerVatCollectedAccountCode;
    }

    const ledgerCashAccountCode = str(b.ledgerCashAccountCode);
    if (ledgerCashAccountCode !== null) {
      if (!ledgerCashAccountCode)
        return withIdNoStore(badRequest('ledgerCashAccountCode requis.'), ctx.requestId);
      if (ledgerCashAccountCode.length > 50)
        return withIdNoStore(badRequest('ledgerCashAccountCode trop long (50 max).'), ctx.requestId);
      data.ledgerCashAccountCode = ledgerCashAccountCode;
    }

    const defaultDepositPercent = num(b.defaultDepositPercent);
    if (defaultDepositPercent !== null) {
      if (isNaN(defaultDepositPercent) || defaultDepositPercent < 0 || defaultDepositPercent > 100)
        return withIdNoStore(badRequest('defaultDepositPercent doit être entre 0 et 100.'), ctx.requestId);
      data.defaultDepositPercent = defaultDepositPercent;
    }

    const paymentTermsDays = num(b.paymentTermsDays);
    if (paymentTermsDays !== null) {
      if (isNaN(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365)
        return withIdNoStore(badRequest('paymentTermsDays doit être entre 0 et 365.'), ctx.requestId);
      data.paymentTermsDays = paymentTermsDays;
    }

    const readLongText = (value: unknown, label: string): string | null => {
      if (value == null || value === '') return null;
      if (typeof value !== 'string') throw new Error(`${label} invalide.`);
      const trimmed = value.trim();
      if (trimmed.length > 5000) throw new Error(`${label} trop long (5000 max).`);
      return trimmed || null;
    };

    try {
      if (Object.prototype.hasOwnProperty.call(b, 'cgvText'))
        data.cgvText = readLongText(b.cgvText, 'cgvText');
      if (Object.prototype.hasOwnProperty.call(b, 'paymentTermsText'))
        data.paymentTermsText = readLongText(b.paymentTermsText, 'paymentTermsText');
      if (Object.prototype.hasOwnProperty.call(b, 'lateFeesText'))
        data.lateFeesText = readLongText(b.lateFeesText, 'lateFeesText');
      if (Object.prototype.hasOwnProperty.call(b, 'fixedIndemnityText'))
        data.fixedIndemnityText = readLongText(b.fixedIndemnityText, 'fixedIndemnityText');
      if (Object.prototype.hasOwnProperty.call(b, 'legalMentionsText'))
        data.legalMentionsText = readLongText(b.legalMentionsText, 'legalMentionsText');
    } catch (err) {
      return withIdNoStore(badRequest((err as Error).message), ctx.requestId);
    }

    if (b.enableAutoNumbering !== undefined) data.enableAutoNumbering = bool(b.enableAutoNumbering);

    const vatRatePercent = num(b.vatRatePercent);
    if (vatRatePercent !== null) {
      if (isNaN(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100)
        return withIdNoStore(badRequest('vatRatePercent doit être entre 0 et 100.'), ctx.requestId);
      data.vatRatePercent = vatRatePercent;
    }

    if (b.vatEnabled !== undefined) data.vatEnabled = bool(b.vatEnabled);
    if (b.allowMembersInvite !== undefined) data.allowMembersInvite = bool(b.allowMembersInvite);
    if (b.allowViewerExport !== undefined) data.allowViewerExport = bool(b.allowViewerExport);
    if (b.integrationStripeEnabled !== undefined)
      data.integrationStripeEnabled = bool(b.integrationStripeEnabled);

    const stripeKey = str(b.integrationStripePublicKey);
    if (stripeKey !== null) {
      if (stripeKey.length > 200)
        return withIdNoStore(badRequest('integrationStripePublicKey trop long (200 max).'), ctx.requestId);
      data.integrationStripePublicKey = stripeKey || null;
    }

    if (Object.keys(data).length === 0) {
      return withIdNoStore(badRequest('Aucun champ valide à mettre à jour.'), ctx.requestId);
    }

    await getOrCreateSettings(ctx.businessId);
    const updated = await prisma.businessSettings.update({
      where: { businessId: ctx.businessId },
      data,
    });

    return jsonb({ item: serialize(updated) }, ctx.requestId);
  }
);
