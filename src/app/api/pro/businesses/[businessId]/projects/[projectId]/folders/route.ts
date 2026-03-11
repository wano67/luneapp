import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// GET /api/pro/businesses/:businessId/projects/:projectId/folders
// List folder contents at a given level (parentId=null → root)
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const url = new URL(req.url);
    const parentIdParam = url.searchParams.get('parentId');
    const parentId = parentIdParam ? parseId(parentIdParam) : null;

    const [folders, documents] = await Promise.all([
      prisma.documentFolder.findMany({
        where: { businessId: ctx.businessId, projectId, parentId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          parentId: true,
          createdAt: true,
          _count: { select: { children: true, documents: true } },
        },
      }),
      prisma.businessDocument.findMany({
        where: { businessId: ctx.businessId, projectId, folderId: parentId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          kind: true,
          folderId: true,
          createdAt: true,
        },
      }),
    ]);

    return jsonb({ folders, documents }, ctx.requestId);
  }
);

// POST /api/pro/businesses/:businessId/projects/:projectId/folders
// Create a new folder
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:folders:create:${ctx.businessId}:${ctx.userId}`,
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

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return badRequest('Le nom du dossier est requis.');
    if (name.length > 100) return badRequest('Le nom du dossier est trop long (max 100 caractères).');

    const parentIdRaw = typeof body.parentId === 'string' ? body.parentId.trim() : null;
    let parentId: bigint | null = null;

    if (parentIdRaw) {
      parentId = parseId(parentIdRaw);

      const parentFolder = await prisma.documentFolder.findFirst({
        where: { id: parentId, businessId: ctx.businessId, projectId },
        select: { id: true, parentId: true },
      });
      if (!parentFolder) return badRequest('Dossier parent introuvable.');

      // Check nesting depth (max 5 levels) by traversing parent chain
      let depth = 1;
      let currentParentId = parentFolder.parentId;
      while (currentParentId) {
        depth++;
        if (depth >= 5) return badRequest('Profondeur maximale de dossiers atteinte (5 niveaux).');
        const ancestor = await prisma.documentFolder.findFirst({
          where: { id: currentParentId },
          select: { parentId: true },
        });
        if (!ancestor) break;
        currentParentId = ancestor.parentId;
      }
    }

    const folder = await prisma.documentFolder.create({
      data: {
        businessId: ctx.businessId,
        projectId,
        parentId,
        name,
        createdByUserId: ctx.userId,
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        _count: { select: { children: true, documents: true } },
      },
    });

    return jsonbCreated({ item: folder }, ctx.requestId);
  }
);
