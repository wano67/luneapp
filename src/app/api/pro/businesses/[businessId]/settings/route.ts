import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getErrorMessage,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function serialize(settings: {
  id: bigint;
  businessId: bigint;
  invoicePrefix: string;
  quotePrefix: string;
  defaultDepositPercent: number;
  paymentTermsDays: number;
  enableAutoNumbering: boolean;
  vatRatePercent: number;
  vatEnabled: boolean;
  allowMembersInvite: boolean;
  allowViewerExport: boolean;
  integrationStripeEnabled: boolean;
  integrationStripePublicKey: string | null;
  accountInventoryCode: string;
  accountCogsCode: string;
  accountCashCode: string;
  accountRevenueCode: string;
  ledgerSalesAccountCode: string;
  ledgerVatCollectedAccountCode: string;
  ledgerCashAccountCode: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: settings.id.toString(),
    businessId: settings.businessId.toString(),
    invoicePrefix: settings.invoicePrefix,
    quotePrefix: settings.quotePrefix,
    defaultDepositPercent: settings.defaultDepositPercent,
    paymentTermsDays: settings.paymentTermsDays,
    enableAutoNumbering: settings.enableAutoNumbering,
    vatRatePercent: settings.vatRatePercent,
    vatEnabled: settings.vatEnabled,
    allowMembersInvite: settings.allowMembersInvite,
    allowViewerExport: settings.allowViewerExport,
    integrationStripeEnabled: settings.integrationStripeEnabled,
    integrationStripePublicKey: settings.integrationStripePublicKey,
    accountInventoryCode: settings.accountInventoryCode,
    accountCogsCode: settings.accountCogsCode,
    accountCashCode: settings.accountCashCode,
    accountRevenueCode: settings.accountRevenueCode,
    ledgerSalesAccountCode: settings.ledgerSalesAccountCode,
    ledgerVatCollectedAccountCode: settings.ledgerVatCollectedAccountCode,
    ledgerCashAccountCode: settings.ledgerCashAccountCode,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

async function getOrCreateSettings(businessId: bigint) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });
}

// GET /api/pro/businesses/{businessId}/settings
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  try {
    const settings = await getOrCreateSettings(businessIdBigInt);
    return withIdNoStore(jsonNoStore({ item: serialize(settings) }), requestId);
  } catch (error) {
    console.error({ requestId, route: 'GET /api/pro/businesses/[businessId]/settings', error });
    return withIdNoStore(
      NextResponse.json({ error: 'Impossible de charger les paramètres.' }, { status: 500 }),
      requestId
    );
  }
}

// PATCH /api/pro/businesses/{businessId}/settings
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:settings:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : null);
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : typeof v === 'string' && v.trim() ? Number(v) : null;
  const bool = (v: unknown) => (v === true || v === 'true');

  const invoicePrefix = str((body as Record<string, unknown>).invoicePrefix);
  if (invoicePrefix !== null) {
    if (!invoicePrefix) return withIdNoStore(badRequest('invoicePrefix requis.'), requestId);
    if (invoicePrefix.length > 50) return withIdNoStore(badRequest('invoicePrefix trop long (50 max).'), requestId);
    data.invoicePrefix = invoicePrefix;
  }

  const quotePrefix = str((body as Record<string, unknown>).quotePrefix);
  if (quotePrefix !== null) {
    if (!quotePrefix) return withIdNoStore(badRequest('quotePrefix requis.'), requestId);
    if (quotePrefix.length > 50) return withIdNoStore(badRequest('quotePrefix trop long (50 max).'), requestId);
    data.quotePrefix = quotePrefix;
  }

  const accountInventoryCode = str((body as Record<string, unknown>).accountInventoryCode);
  if (accountInventoryCode !== null) {
    if (!accountInventoryCode) return withIdNoStore(badRequest('accountInventoryCode requis.'), requestId);
    if (accountInventoryCode.length > 50) {
      return withIdNoStore(badRequest('accountInventoryCode trop long (50 max).'), requestId);
    }
    data.accountInventoryCode = accountInventoryCode;
  }
  const accountCogsCode = str((body as Record<string, unknown>).accountCogsCode);
  if (accountCogsCode !== null) {
    if (!accountCogsCode) return withIdNoStore(badRequest('accountCogsCode requis.'), requestId);
    if (accountCogsCode.length > 50) return withIdNoStore(badRequest('accountCogsCode trop long (50 max).'), requestId);
    data.accountCogsCode = accountCogsCode;
  }
  const accountCashCode = str((body as Record<string, unknown>).accountCashCode);
  if (accountCashCode !== null) {
    if (!accountCashCode) return withIdNoStore(badRequest('accountCashCode requis.'), requestId);
    if (accountCashCode.length > 50) return withIdNoStore(badRequest('accountCashCode trop long (50 max).'), requestId);
    data.accountCashCode = accountCashCode;
  }
  const accountRevenueCode = str((body as Record<string, unknown>).accountRevenueCode);
  if (accountRevenueCode !== null) {
    if (!accountRevenueCode) return withIdNoStore(badRequest('accountRevenueCode requis.'), requestId);
    if (accountRevenueCode.length > 50) return withIdNoStore(badRequest('accountRevenueCode trop long (50 max).'), requestId);
    data.accountRevenueCode = accountRevenueCode;
  }
  const ledgerSalesAccountCode = str((body as Record<string, unknown>).ledgerSalesAccountCode);
  if (ledgerSalesAccountCode !== null) {
    if (!ledgerSalesAccountCode) return withIdNoStore(badRequest('ledgerSalesAccountCode requis.'), requestId);
    if (ledgerSalesAccountCode.length > 50) {
      return withIdNoStore(badRequest('ledgerSalesAccountCode trop long (50 max).'), requestId);
    }
    data.ledgerSalesAccountCode = ledgerSalesAccountCode;
  }
  const ledgerVatCollectedAccountCode = str((body as Record<string, unknown>).ledgerVatCollectedAccountCode);
  if (ledgerVatCollectedAccountCode !== null) {
    if (!ledgerVatCollectedAccountCode) {
      return withIdNoStore(badRequest('ledgerVatCollectedAccountCode requis.'), requestId);
    }
    if (ledgerVatCollectedAccountCode.length > 50) {
      return withIdNoStore(badRequest('ledgerVatCollectedAccountCode trop long (50 max).'), requestId);
    }
    data.ledgerVatCollectedAccountCode = ledgerVatCollectedAccountCode;
  }
  const ledgerCashAccountCode = str((body as Record<string, unknown>).ledgerCashAccountCode);
  if (ledgerCashAccountCode !== null) {
    if (!ledgerCashAccountCode) return withIdNoStore(badRequest('ledgerCashAccountCode requis.'), requestId);
    if (ledgerCashAccountCode.length > 50) {
      return withIdNoStore(badRequest('ledgerCashAccountCode trop long (50 max).'), requestId);
    }
    data.ledgerCashAccountCode = ledgerCashAccountCode;
  }

  const defaultDepositPercent = num((body as Record<string, unknown>).defaultDepositPercent);
  if (defaultDepositPercent !== null) {
    if (Number.isNaN(defaultDepositPercent) || defaultDepositPercent < 0 || defaultDepositPercent > 100) {
      return withIdNoStore(badRequest('defaultDepositPercent doit être entre 0 et 100.'), requestId);
    }
    data.defaultDepositPercent = defaultDepositPercent;
  }

  const paymentTermsDays = num((body as Record<string, unknown>).paymentTermsDays);
  if (paymentTermsDays !== null) {
    if (Number.isNaN(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) {
      return withIdNoStore(badRequest('paymentTermsDays doit être entre 0 et 365.'), requestId);
    }
    data.paymentTermsDays = paymentTermsDays;
  }

  if ((body as Record<string, unknown>).enableAutoNumbering !== undefined) {
    data.enableAutoNumbering = bool((body as Record<string, unknown>).enableAutoNumbering);
  }

  const vatRatePercent = num((body as Record<string, unknown>).vatRatePercent);
  if (vatRatePercent !== null) {
    if (Number.isNaN(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
      return withIdNoStore(badRequest('vatRatePercent doit être entre 0 et 100.'), requestId);
    }
    data.vatRatePercent = vatRatePercent;
  }

  if ((body as Record<string, unknown>).vatEnabled !== undefined) {
    data.vatEnabled = bool((body as Record<string, unknown>).vatEnabled);
  }

  if ((body as Record<string, unknown>).allowMembersInvite !== undefined) {
    data.allowMembersInvite = bool((body as Record<string, unknown>).allowMembersInvite);
  }

  if ((body as Record<string, unknown>).allowViewerExport !== undefined) {
    data.allowViewerExport = bool((body as Record<string, unknown>).allowViewerExport);
  }

  if ((body as Record<string, unknown>).integrationStripeEnabled !== undefined) {
    data.integrationStripeEnabled = bool((body as Record<string, unknown>).integrationStripeEnabled);
  }

  const stripeKey = str((body as Record<string, unknown>).integrationStripePublicKey);
  if (stripeKey !== null) {
    if (stripeKey.length > 200) {
      return withIdNoStore(badRequest('integrationStripePublicKey trop long (200 max).'), requestId);
    }
    data.integrationStripePublicKey = stripeKey || null;
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucun champ valide à mettre à jour.'), requestId);
  }

  try {
    await getOrCreateSettings(businessIdBigInt);
    const updated = await prisma.businessSettings.update({
      where: { businessId: businessIdBigInt },
      data,
    });
    return withIdNoStore(jsonNoStore({ item: serialize(updated) }), requestId);
  } catch (error) {
    console.error({
      requestId,
      route: 'PATCH /api/pro/businesses/[businessId]/settings',
      error: getErrorMessage(error),
    });
    return withIdNoStore(
      NextResponse.json({ error: 'Impossible de mettre à jour les paramètres.' }, { status: 500 }),
      requestId
    );
  }
}
