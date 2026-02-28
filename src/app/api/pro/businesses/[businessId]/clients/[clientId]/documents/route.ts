import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, getErrorMessage, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { saveLocalFile } from '@/server/storage/local';
import { DocumentKind, Prisma } from '@/generated/prisma';

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
export const GET = withBusinessRoute<{ businessId: string; clientId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const clientId = parseId(params.clientId);

    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!client) return notFound('Client introuvable.');

    let uploadsWarning: string | undefined;
    let uploads: Awaited<ReturnType<typeof prisma.businessDocument.findMany>> = [];

    try {
      uploads = await prisma.businessDocument.findMany({
        where: { businessId: ctx.businessId, clientId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (error) {
      if (isPrismaKnownError(error) && error.code === 'P2021') {
        uploadsWarning = BUSINESS_DOCUMENT_WARNING;
      } else {
        throw error;
      }
    }

    const [invoices, quotes] = await Promise.all([
      prisma.invoice.findMany({
        where: { businessId: ctx.businessId, clientId },
        orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      prisma.quote.findMany({
        where: { businessId: ctx.businessId, clientId },
        orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    ]);

    return jsonb({
      uploads: uploads.map((d) => ({
        id: d.id,
        title: d.title,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        kind: d.kind,
        createdAt: d.createdAt,
        downloadUrl: `/api/pro/businesses/${ctx.businessId}/documents/${d.id}/download`,
        viewUrl: `/api/pro/businesses/${ctx.businessId}/documents/${d.id}/view`,
      })),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number ?? `INV-${inv.id}`,
        status: inv.status,
        totalCents: inv.totalCents,
        issuedAt: inv.issuedAt ?? inv.createdAt,
        currency: inv.currency,
        pdfUrl: `/api/pro/businesses/${ctx.businessId}/invoices/${inv.id}/pdf`,
      })),
      quotes: quotes.map((q) => ({
        id: q.id,
        number: q.number ?? `DEV-${q.id}`,
        status: q.status,
        totalCents: q.totalCents,
        issuedAt: q.issuedAt ?? q.createdAt,
        currency: q.currency,
        pdfUrl: `/api/pro/businesses/${ctx.businessId}/quotes/${q.id}/pdf`,
      })),
      ...(uploadsWarning ? { warning: uploadsWarning } : {}),
    }, ctx.requestId);
  }
);

// POST /api/pro/businesses/:businessId/clients/:clientId/documents
export const POST = withBusinessRoute<{ businessId: string; clientId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:documents:upload:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const clientId = parseId(params.clientId);

    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!client) return notFound('Client introuvable.');

    const form = await req.formData().catch(() => null);
    if (!form) return badRequest('FormData requis.');
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('Fichier requis.');

    if (file.size === 0) return badRequest('Fichier vide.');
    if (file.size > MAX_UPLOAD_BYTES) return badRequest('Fichier trop volumineux (max 20MB).');
    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime)) return badRequest('Type de fichier non autorisé.');

    const titleRaw = form.get('title');
    const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : file.name;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey, filename, sha } = await saveLocalFile({
      buffer,
      filename: file.name,
      businessId: ctx.businessId,
      clientId,
    });

    const created = await prisma.businessDocument.create({
      data: {
        businessId: ctx.businessId,
        clientId,
        title,
        filename,
        mimeType: mime,
        sizeBytes: buffer.length,
        storageKey,
        sha256: sha,
        kind: DocumentKind.FILE,
        createdByUserId: ctx.userId,
      },
    }).catch((error) => {
      if (isPrismaKnownError(error) && error.code === 'P2021') {
        return null;
      }
      throw error;
    });

    if (!created) {
      const res = NextResponse.json({ error: BUSINESS_DOCUMENT_WARNING }, { status: 503 });
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }

    return jsonbCreated({
      item: {
        id: created.id,
        title: created.title,
        filename: created.filename,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
        createdAt: created.createdAt,
      },
    }, ctx.requestId);
  }
);
