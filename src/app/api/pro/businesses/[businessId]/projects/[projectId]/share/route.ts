import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';
import { buildBaseUrl } from '@/server/http/baseUrl';
import { sendProjectShareEmail } from '@/server/services/email';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/**
 * POST /api/pro/businesses/{businessId}/projects/{projectId}/share
 * Create a share link for a project.
 */
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `share:create:${ctx.businessId}`, limit: 30, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, req, params) => {
    const projectId = parseIdOpt(params?.projectId);
    if (!projectId) return badRequest('projectId invalide.');

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true, name: true, clientId: true, client: { select: { email: true, name: true } } },
    });
    if (!project) return notFound('Projet introuvable.');

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const clientEmail = typeof body?.clientEmail === 'string' ? body.clientEmail.trim() || null : null;
    const expiresInDays = typeof body?.expiresInDays === 'number' && body.expiresInDays > 0 ? body.expiresInDays : null;
    const allowClientUpload = body?.allowClientUpload === true;
    const allowVaultAccess = body?.allowVaultAccess === true;
    const rawPassword = typeof body?.password === 'string' ? body.password.trim() || null : null;

    const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 10) : null;

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.projectShareToken.create({
      data: {
        projectId,
        businessId: ctx.businessId,
        token: tokenHash,
        clientEmail: clientEmail ?? project.client?.email ?? null,
        expiresAt,
        allowClientUpload,
        allowVaultAccess,
        passwordHash,
      },
    });

    const baseUrl = buildBaseUrl(req);
    const shareLink = `${baseUrl}/share/${rawToken}`;

    // Send email if recipient is provided
    const emailTo = clientEmail ?? project.client?.email;
    if (emailTo) {
      const business = await prisma.business.findUnique({
        where: { id: ctx.businessId },
        select: { name: true },
      });

      sendProjectShareEmail({
        to: emailTo,
        businessName: business?.name ?? 'Votre prestataire',
        projectName: project.name,
        shareLink,
        expiresAt,
        hasPassword: !!passwordHash,
      }).catch(() => {});
    }

    return jsonbCreated(
      {
        shareLink,
        tokenPreview: rawToken.slice(-6),
        expiresAt: expiresAt?.toISOString() ?? null,
        emailSentTo: emailTo ?? null,
        hasPassword: !!passwordHash,
      },
      ctx.requestId
    );
  }
);

/**
 * GET /api/pro/businesses/{businessId}/projects/{projectId}/share
 * List active share tokens for a project.
 */
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const projectId = parseIdOpt(params?.projectId);
    if (!projectId) return badRequest('projectId invalide.');

    const tokens = await prisma.projectShareToken.findMany({
      where: { projectId, businessId: ctx.businessId },
      select: {
        id: true,
        clientEmail: true,
        token: true,
        expiresAt: true,
        revokedAt: true,
        allowClientUpload: true,
        allowVaultAccess: true,
        passwordHash: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = tokens.map((t) => ({
      id: t.id,
      clientEmail: t.clientEmail,
      tokenPreview: `•••${t.token.slice(-6)}`,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      allowClientUpload: t.allowClientUpload,
      allowVaultAccess: t.allowVaultAccess,
      hasPassword: !!t.passwordHash,
      isActive: !t.revokedAt && (!t.expiresAt || t.expiresAt > new Date()),
      createdAt: t.createdAt,
    }));

    return jsonb({ items }, ctx.requestId);
  }
);

/**
 * DELETE /api/pro/businesses/{businessId}/projects/{projectId}/share
 * Revoke a share token.
 */
export const DELETE = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const projectId = parseIdOpt(params?.projectId);
    if (!projectId) return badRequest('projectId invalide.');

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const tokenId = typeof body?.tokenId === 'string' ? parseIdOpt(body.tokenId) : null;
    if (!tokenId) return badRequest('tokenId requis.');

    const token = await prisma.projectShareToken.findFirst({
      where: { id: tokenId, projectId, businessId: ctx.businessId },
    });
    if (!token) return notFound('Token introuvable.');

    await prisma.projectShareToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    return jsonbNoContent(ctx.requestId);
  }
);
