import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { validateShareToken } from '@/server/share/validateShareToken';
import { verifyShareSession } from '@/server/share/shareSession';

/**
 * GET /api/share/[token] — Public project data by share token.
 * If the link is password-protected and no valid session cookie exists,
 * returns { requiresPassword: true } instead of the full data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:view'),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken } = await params;

  const result = await validateShareToken(rawToken);
  if (!result.ok) return result.response;

  const shareToken = result.token;

  // Password gate
  if (shareToken.passwordHash) {
    const hasSession = await verifyShareSession(request, rawToken);
    if (!hasSession) {
      return NextResponse.json({ requiresPassword: true });
    }
  }

  // Fetch project data — non-sensitive fields only
  const [project, business, taskRows, services, quotes, invoices, payments, documents] = await Promise.all([
    prisma.project.findUnique({
      where: { id: shareToken.projectId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        prestationsText: true,
        createdAt: true,
      },
    }),
    prisma.business.findUnique({
      where: { id: shareToken.businessId },
      select: { name: true, websiteUrl: true },
    }),
    prisma.task.findMany({
      where: { projectId: shareToken.projectId, businessId: shareToken.businessId },
      select: { status: true, progress: true, projectServiceId: true },
    }),
    prisma.projectService.findMany({
      where: { projectId: shareToken.projectId },
      include: {
        service: { select: { name: true, description: true } },
        steps: { select: { name: true, phaseName: true, order: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { position: 'asc' },
    }),
    prisma.quote.findMany({
      where: {
        projectId: shareToken.projectId,
        businessId: shareToken.businessId,
        status: { in: ['SENT', 'SIGNED'] },
      },
      select: {
        id: true,
        number: true,
        status: true,
        totalCents: true,
        currency: true,
        issuedAt: true,
        signedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: {
        projectId: shareToken.projectId,
        businessId: shareToken.businessId,
        status: { in: ['SENT', 'PAID'] },
      },
      select: {
        id: true,
        number: true,
        status: true,
        totalCents: true,
        currency: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: {
        projectId: shareToken.projectId,
        businessId: shareToken.businessId,
        deletedAt: null,
      },
      select: {
        amountCents: true,
        paidAt: true,
        method: true,
      },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.businessDocument.findMany({
      where: { projectId: shareToken.projectId, businessId: shareToken.businessId },
      select: {
        id: true,
        title: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        kind: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!project || !business) {
    return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 });
  }

  // Compute progress
  const tasksSummary = (() => {
    if (!taskRows.length) return { total: 0, open: 0, done: 0, progressPct: 0 };
    let total = 0;
    let done = 0;
    let open = 0;
    let sum = 0;
    for (const t of taskRows) {
      total += 1;
      const pct = t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0;
      sum += pct;
      if (t.status === 'DONE') done += 1;
      else open += 1;
    }
    return { total, done, open, progressPct: Math.round(sum / total) };
  })();

  // Compute per-service progress (pre-index tasks by serviceId to avoid O(n²))
  const tasksByServiceId = new Map<bigint, typeof taskRows>();
  for (const t of taskRows) {
    if (t.projectServiceId) {
      const arr = tasksByServiceId.get(t.projectServiceId);
      if (arr) arr.push(t);
      else tasksByServiceId.set(t.projectServiceId, [t]);
    }
  }
  const serviceData = services.map((ps) => {
    const serviceTasks = tasksByServiceId.get(ps.id) ?? [];
    let sTotal = 0;
    let sDone = 0;
    let sSum = 0;
    for (const t of serviceTasks) {
      sTotal += 1;
      const pct = t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0;
      sSum += pct;
      if (t.status === 'DONE') sDone += 1;
    }
    return {
      name: ps.titleOverride || ps.service.name,
      description: ps.service.description,
      steps: ps.steps.map((s) => ({ name: s.name, phaseName: s.phaseName })),
      tasksSummary: {
        total: sTotal,
        done: sDone,
        progressPct: sTotal > 0 ? Math.round(sSum / sTotal) : 0,
      },
    };
  });

  // Serialize BigInts
  const serialize = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serialize);
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        result[k] = serialize(v);
      }
      return result;
    }
    return obj;
  };

  const response = {
    allowClientUpload: shareToken.allowClientUpload,
    allowVaultAccess: shareToken.allowVaultAccess,
    business: { name: business.name, websiteUrl: business.websiteUrl },
    project: {
      name: project.name,
      status: project.status,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      prestationsText: project.prestationsText,
      progressPct: tasksSummary.progressPct,
      tasksSummary,
    },
    services: serviceData,
    quotes: serialize(quotes),
    invoices: serialize(invoices),
    payments: serialize(payments),
    documents: serialize(documents),
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  });
}
