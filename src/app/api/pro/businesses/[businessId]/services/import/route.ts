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
import { BusinessReferenceType } from '@/generated/prisma/client';

type ImportRow = Record<string, unknown>;

type ImportMapping = {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  price?: string | null;
  vat?: string | null;
  duration?: string | null;
  type?: string | null;
  category?: string | null;
};

type ImportOptions = {
  createMissingCategories?: boolean;
};

type ImportBody = {
  mapping?: ImportMapping;
  rows?: ImportRow[];
  options?: ImportOptions;
};

type ImportError = { row: number; message: string };

const MAX_ROWS = 500;

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function normalizeStr(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCode(raw: unknown): { value: string | null; error?: string } {
  const input = normalizeStr(raw);
  if (!input) return { value: null, error: 'Code requis.' };
  const prefixed = input.startsWith('SER-') ? input : `SER-${input}`;
  if (!/^SER-[0-9A-Za-z_-]+$/.test(prefixed)) return { value: null, error: 'Code invalide (format SER-XXX).' };
  if (prefixed.length > 50) return { value: null, error: 'Code trop long (50 max).' };
  return { value: prefixed };
}

function parsePriceCents(raw: unknown): { value: number | null; error?: string } {
  const s = normalizeStr(raw);
  if (!s) return { value: null };
  const normalized = s.replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return { value: null, error: 'Prix invalide.' };
  if (num < 0) return { value: null, error: 'Prix négatif.' };
  return { value: Math.round(num * 100) };
}

function parseVat(raw: unknown): { value: number | null; error?: string } {
  const s = normalizeStr(raw);
  if (!s) return { value: null };
  const normalized = s.replace('%', '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return { value: null, error: 'TVA invalide.' };
  const percent = num > 1 ? num : num * 100;
  if (percent < 0 || percent > 100) return { value: null, error: 'TVA hors borne (0-100).' };
  return { value: Math.round(percent) };
}

function parseDuration(raw: unknown): { value: number | null; error?: string } {
  const s = normalizeStr(raw);
  if (!s) return { value: null };
  const cleaned = s.replace(/h$/i, '').replace(',', '.');
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return { value: null, error: 'Durée invalide.' };
  if (num < 0) return { value: null, error: 'Durée négative.' };
  return { value: Math.round(num) };
}

async function resolveCategoryId(
  businessId: bigint,
  name: string,
  cache: Map<string, bigint>,
  createMissing: boolean
): Promise<{ id: bigint | null; error?: string }> {
  const key = name.trim().toLowerCase();
  if (!key) return { id: null };
  if (cache.has(key)) return { id: cache.get(key)! };

  const existing = await prisma.businessReference.findFirst({
    where: {
      businessId,
      type: BusinessReferenceType.CATEGORY,
      name: { equals: name.trim(), mode: 'insensitive' },
      isArchived: false,
    },
    select: { id: true },
  });
  if (existing) {
    cache.set(key, existing.id);
    return { id: existing.id };
  }

  if (!createMissing) return { id: null, error: `Catégorie « ${name} » introuvable.` };

  const created = await prisma.businessReference.create({
    data: {
      businessId,
      name: name.trim(),
      type: BusinessReferenceType.CATEGORY,
    },
    select: { id: true },
  });
  cache.set(key, created.id);
  return { id: created.id };
}

// POST /api/pro/businesses/{businessId}/services/import
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:services:import:${businessIdBigInt}:${userId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = (await request.json().catch(() => null)) as ImportBody | null;
  if (!body || !Array.isArray(body.rows) || !body.rows.length) {
    return withIdNoStore(badRequest('rows requis.'), requestId);
  }
  if (!body.mapping || typeof body.mapping !== 'object') {
    return withIdNoStore(badRequest('mapping requis.'), requestId);
  }

  const rows = body.rows.slice(0, MAX_ROWS);
  const mapping: ImportMapping = body.mapping;
  if (!mapping.code || !mapping.name) {
    return withIdNoStore(badRequest('Mapping code et name requis.'), requestId);
  }
  const createMissingCategories = Boolean(body.options?.createMissingCategories);

  const categoryCache = new Map<string, bigint>();
  const errors: ImportError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx] || {};
    const rowNumber = idx + 1;

    const codeRaw = (row as Record<string, unknown>)[mapping.code] ?? '';
    const nameRaw = (row as Record<string, unknown>)[mapping.name] ?? '';
    const descRaw = mapping.description ? (row as Record<string, unknown>)[mapping.description] : '';
    const priceRaw = mapping.price ? (row as Record<string, unknown>)[mapping.price] : '';
    const vatRaw = mapping.vat ? (row as Record<string, unknown>)[mapping.vat] : '';
    const durationRaw = mapping.duration ? (row as Record<string, unknown>)[mapping.duration] : '';
    const typeRaw = mapping.type ? (row as Record<string, unknown>)[mapping.type] : '';
    const categoryRaw = mapping.category ? (row as Record<string, unknown>)[mapping.category] : '';

    const codeNormalized = normalizeCode(codeRaw);
    if (codeNormalized.error || !codeNormalized.value) {
      errors.push({ row: rowNumber, message: codeNormalized.error ?? 'Code invalide.' });
      skippedCount += 1;
      continue;
    }

    const name = normalizeStr(nameRaw);
    if (!name) {
      errors.push({ row: rowNumber, message: 'Nom requis.' });
      skippedCount += 1;
      continue;
    }
    if (name.length > 140) {
      errors.push({ row: rowNumber, message: 'Nom trop long (140 max).' });
      skippedCount += 1;
      continue;
    }

    const desc = normalizeStr(descRaw) || null;
    if (desc && desc.length > 2000) {
      errors.push({ row: rowNumber, message: 'Description trop longue.' });
      skippedCount += 1;
      continue;
    }

    const priceParsed = parsePriceCents(priceRaw);
    if (priceParsed.error) {
      errors.push({ row: rowNumber, message: priceParsed.error });
      skippedCount += 1;
      continue;
    }

    const vatParsed = parseVat(vatRaw);
    if (vatParsed.error) {
      errors.push({ row: rowNumber, message: vatParsed.error });
      skippedCount += 1;
      continue;
    }

    const durationParsed = parseDuration(durationRaw);
    if (durationParsed.error) {
      errors.push({ row: rowNumber, message: durationParsed.error });
      skippedCount += 1;
      continue;
    }

    let categoryReferenceId: bigint | null = null;
    const categoryName = normalizeStr(categoryRaw);
    if (categoryName) {
      const categoryResult = await resolveCategoryId(
        businessIdBigInt,
        categoryName,
        categoryCache,
        createMissingCategories
      );
      if (categoryResult.error) {
        errors.push({ row: rowNumber, message: categoryResult.error });
        skippedCount += 1;
        continue;
      }
      categoryReferenceId = categoryResult.id;
    }

    try {
      const existing = await prisma.service.findFirst({
        where: { businessId: businessIdBigInt, code: codeNormalized.value },
      });

      if (existing) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            name,
            description: desc ?? undefined,
            type: normalizeStr(typeRaw) || undefined,
            defaultPriceCents: priceParsed.value ?? undefined,
            vatRate: vatParsed.value ?? undefined,
            durationHours: durationParsed.value ?? undefined,
            categoryReferenceId: categoryReferenceId ?? undefined,
          },
        });
        updatedCount += 1;
      } else {
        await prisma.service.create({
          data: {
            businessId: businessIdBigInt,
            code: codeNormalized.value,
            name,
            description: desc ?? undefined,
            type: normalizeStr(typeRaw) || undefined,
            defaultPriceCents: priceParsed.value ?? undefined,
            vatRate: vatParsed.value ?? undefined,
            durationHours: durationParsed.value ?? undefined,
            categoryReferenceId: categoryReferenceId ?? undefined,
          },
        });
        createdCount += 1;
      }
    } catch (error) {
      console.error({
        requestId,
        route: 'POST /api/pro/businesses/[businessId]/services/import',
        error: getErrorMessage(error),
      });
      errors.push({ row: rowNumber, message: 'Erreur inattendue (voir logs).' });
      skippedCount += 1;
    }
  }

  return withIdNoStore(
    jsonNoStore({
      createdCount,
      updatedCount,
      skippedCount,
      errors,
    }),
    requestId
  );
}
