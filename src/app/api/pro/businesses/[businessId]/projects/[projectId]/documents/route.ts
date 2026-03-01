import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { saveLocalFile } from '@/server/storage/local';
import { DocumentKind, Prisma } from '@/generated/prisma';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

// GET /api/pro/businesses/:businessId/projects/:projectId/documents
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    let items: Awaited<ReturnType<typeof prisma.businessDocument.findMany>> = [];
    try {
      items = await prisma.businessDocument.findMany({
        where: { businessId: ctx.businessId, projectId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    } catch (error) {
      if (isPrismaKnownError(error) && error.code === 'P2021') {
        return jsonb({ items: [], warning: 'Table manquante. Lancer les migrations.' }, ctx.requestId);
      }
      throw error;
    }

    return jsonb({
      items: items.map((d) => ({
        id: d.id,
        title: d.title,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        kind: d.kind,
        createdAt: d.createdAt,
      })),
    }, ctx.requestId);
  }
);

// POST /api/pro/businesses/:businessId/projects/:projectId/documents
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-docs:upload:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const form = await req.formData().catch(() => null);
    if (!form) return badRequest('FormData requis.');
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('Fichier requis.');

    if (file.size === 0) return badRequest('Fichier vide.');
    if (file.size > MAX_UPLOAD_BYTES) return badRequest('Fichier trop volumineux (max 20 Mo).');
    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime)) return badRequest('Type de fichier non autorisé.');

    const titleRaw = form.get('title');
    const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : file.name;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey, filename, sha } = await saveLocalFile({
      buffer,
      filename: file.name,
      businessId: ctx.businessId,
      projectId,
    });

    const created = await prisma.businessDocument.create({
      data: {
        businessId: ctx.businessId,
        projectId,
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
      if (isPrismaKnownError(error) && error.code === 'P2021') return null;
      throw error;
    });

    if (!created) {
      const res = NextResponse.json({ error: 'Table manquante. Lancer les migrations.' }, { status: 503 });
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
