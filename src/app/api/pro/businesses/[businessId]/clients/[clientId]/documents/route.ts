import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import {
  badRequest,
  forbidden,
  getErrorMessage,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { saveLocalFile } from '@/server/storage/local';
import { DocumentKind, Prisma } from '@/generated/prisma';

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

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const BUSINESS_DOCUMENT_WARNING = 'BusinessDocument table missing. Run migrations.';
const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

// GET /api/pro/businesses/:businessId/clients/:clientId/documents
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> },
) {
  const requestId = getRequestId(request);
  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) return withIdNoStore(badRequest('Paramètres invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!client) return withIdNoStore(notFound('Client introuvable.'), requestId);

  let uploadsWarning: string | undefined;
  let uploads: Awaited<ReturnType<typeof prisma.businessDocument.findMany>> = [];

  try {
    uploads = await prisma.businessDocument.findMany({
      where: { businessId: businessIdBigInt, clientId: clientIdBigInt },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  } catch (error) {
    if (isPrismaKnownError(error) && error.code === 'P2021') {
      uploadsWarning = BUSINESS_DOCUMENT_WARNING;
      console.warn('businessDocument table missing', { requestId, error: getErrorMessage(error) });
    } else {
      throw error;
    }
  }

  const [invoices, quotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { businessId: businessIdBigInt, clientId: clientIdBigInt },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    prisma.quote.findMany({
      where: { businessId: businessIdBigInt, clientId: clientIdBigInt },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
  ]);

  return withIdNoStore(
    jsonNoStore({
      uploads: uploads.map((d) => ({
        id: d.id.toString(),
        title: d.title,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        kind: d.kind,
        createdAt: d.createdAt.toISOString(),
        downloadUrl: `/api/pro/businesses/${businessId}/documents/${d.id.toString()}/download`,
        viewUrl: `/api/pro/businesses/${businessId}/documents/${d.id.toString()}/view`,
      })),
      invoices: invoices.map((inv) => ({
        id: inv.id.toString(),
        number: inv.number ?? `INV-${inv.id}`,
        status: inv.status,
        totalCents: Number(inv.totalCents),
        issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : inv.createdAt.toISOString(),
        currency: inv.currency,
        pdfUrl: `/api/pro/businesses/${businessId}/invoices/${inv.id.toString()}/pdf`,
      })),
      quotes: quotes.map((q) => ({
        id: q.id.toString(),
        number: q.number ?? `DEV-${q.id}`,
        status: q.status,
        totalCents: Number(q.totalCents),
        issuedAt: q.issuedAt ? q.issuedAt.toISOString() : q.createdAt.toISOString(),
        currency: q.currency,
        pdfUrl: `/api/pro/businesses/${businessId}/quotes/${q.id.toString()}/pdf`,
      })),
      ...(uploadsWarning ? { warning: uploadsWarning } : {}),
    }),
    requestId,
  );
}

// POST /api/pro/businesses/:businessId/clients/:clientId/documents
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> },
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, clientId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) return withIdNoStore(badRequest('Paramètres invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:documents:upload:${businessIdBigInt}:${userId}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!client) return withIdNoStore(notFound('Client introuvable.'), requestId);

  const form = await request.formData().catch(() => null);
  if (!form) return withIdNoStore(badRequest('FormData requis.'), requestId);
  const file = form.get('file');
  if (!(file instanceof File)) return withIdNoStore(badRequest('Fichier requis.'), requestId);

  if (file.size === 0) return withIdNoStore(badRequest('Fichier vide.'), requestId);
  if (file.size > MAX_UPLOAD_BYTES) return withIdNoStore(badRequest('Fichier trop volumineux (max 20MB).'), requestId);
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.includes(mime)) return withIdNoStore(badRequest('Type de fichier non autorisé.'), requestId);

  const titleRaw = form.get('title');
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : file.name;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storageKey, filename, sha } = await saveLocalFile({
    buffer,
    filename: file.name,
    businessId: businessIdBigInt,
    clientId: clientIdBigInt,
  });

  const created = await prisma.businessDocument.create({
    data: {
      businessId: businessIdBigInt,
      clientId: clientIdBigInt,
      title,
      filename,
      mimeType: mime,
      sizeBytes: buffer.length,
      storageKey,
      sha256: sha,
      kind: DocumentKind.FILE,
      createdByUserId: BigInt(userId),
    },
  }).catch((error) => {
    if (isPrismaKnownError(error) && error.code === 'P2021') {
      console.error('businessDocument table missing on upload', { requestId, error: getErrorMessage(error) });
      return null;
    }
    throw error;
  });

  if (!created) {
    return withIdNoStore(
      NextResponse.json({ error: BUSINESS_DOCUMENT_WARNING }, { status: 503 }),
      requestId,
    );
  }

  return withIdNoStore(
    NextResponse.json(
      {
        id: created.id.toString(),
        title: created.title,
        filename: created.filename,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    ),
    requestId,
  );
}
