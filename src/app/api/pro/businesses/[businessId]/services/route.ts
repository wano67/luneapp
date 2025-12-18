import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { TaskPhase } from '@/generated/prisma/client';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

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

function normalizeStr(v: unknown) {
  return String(v ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function validateCode(code: string) {
  if (!code) return 'Code requis.';
  if (!/^SER-[0-9A-Za-z_-]+$/.test(code)) return 'Code invalide (format SER-XXX).';
  if (code.length > 50) return 'Code trop long.';
  return null;
}

type ServiceTemplateInput = {
  phase: TaskPhase | null;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

type ServiceBodyParsed =
  | { error: string }
  | {
      code: string;
      name: string;
      type: string | null;
      description: string | null;
      defaultPriceCents: number | null;
      tjmCents: number | null;
      durationHours: number | null;
      vatRate: number | null;
      templates: ServiceTemplateInput[];
    };

function validateServiceBody(body: unknown): ServiceBodyParsed {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const code = normalizeStr(body.code);
  const name = normalizeStr(body.name);
  const type = normalizeStr(body.type);
  const description = normalizeStr(body.description);
  const defaultPriceCents =
    typeof body.defaultPriceCents === 'number' && Number.isFinite(body.defaultPriceCents)
      ? Math.max(0, Math.trunc(body.defaultPriceCents))
      : null;
  const tjmCents =
    typeof body.tjmCents === 'number' && Number.isFinite(body.tjmCents)
      ? Math.max(0, Math.trunc(body.tjmCents))
      : null;
  const durationHours =
    typeof body.durationHours === 'number' && Number.isFinite(body.durationHours)
      ? Math.max(0, Math.trunc(body.durationHours))
      : null;
  const vatRate =
    typeof body.vatRate === 'number' && Number.isFinite(body.vatRate)
      ? Math.max(0, Math.trunc(body.vatRate))
      : null;

  const codeErr = validateCode(code);
  if (codeErr) return { error: codeErr };
  if (!name) return { error: 'Nom requis.' };
  if (name.length > 140) return { error: 'Nom trop long (140 max).' };
  if (description && description.length > 2000) return { error: 'Description trop longue.' };

  const templates: ServiceTemplateInput[] = Array.isArray(body.taskTemplates)
    ? body.taskTemplates.filter(isRecord).map((t) => {
        const phaseRaw = typeof t.phase === 'string' ? t.phase : null;
        const phase =
          phaseRaw && Object.values(TaskPhase).includes(phaseRaw as TaskPhase)
            ? (phaseRaw as TaskPhase)
            : null;
        return {
          phase,
          title: normalizeStr(t.title),
          defaultAssigneeRole: normalizeStr(t.defaultAssigneeRole || '') || null,
          defaultDueOffsetDays:
            typeof t.defaultDueOffsetDays === 'number' && Number.isFinite(t.defaultDueOffsetDays)
              ? Math.trunc(t.defaultDueOffsetDays)
              : null,
        };
      })
    : [];

  for (const tpl of templates) {
    if (!tpl.title) return { error: 'Template tâche : titre requis.' };
    if (tpl.title.length > 180) return { error: 'Template tâche : titre trop long.' };
    if (tpl.defaultAssigneeRole && tpl.defaultAssigneeRole.length > 120)
      return { error: 'Template tâche : assigneeRole trop long.' };
  }

  return {
    code,
    name,
    type: type || null,
    description: description || null,
    defaultPriceCents,
    tjmCents,
    durationHours,
    vatRate,
    templates,
  };
}

function ensureServiceDelegate(requestId: string) {
  if (!(prisma as { service?: unknown }).service) {
    return withIdNoStore(
      NextResponse.json(
        { error: 'Prisma client not generated / wrong import (service delegate absent).' },
        { status: 500 }
      ),
      requestId
    );
  }
  return null;
}

// GET /api/pro/businesses/{businessId}/services
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  const delegateError = ensureServiceDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const type = searchParams.get('type')?.trim();

  const services = await prisma.service.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(type ? { type: { equals: type, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return jsonNoStore({
    items: services.map((s) => ({
      id: s.id.toString(),
      businessId: s.businessId.toString(),
      code: s.code,
      name: s.name,
      type: s.type,
      description: s.description,
      defaultPriceCents: s.defaultPriceCents?.toString() ?? null,
      tjmCents: s.tjmCents?.toString() ?? null,
      durationHours: s.durationHours,
      vatRate: s.vatRate,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}

// POST /api/pro/businesses/{businessId}/services
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const delegateError = ensureServiceDelegate(requestId);
  if (delegateError) return delegateError;

  const limited = rateLimit(request, {
    key: `pro:services:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = validateServiceBody(body);
  if ('error' in parsed) return withRequestId(badRequest(parsed.error), requestId);

  try {
    const created = await prisma.service.create({
      data: {
        businessId: businessIdBigInt,
        code: parsed.code,
        name: parsed.name,
        type: parsed.type || undefined,
        description: parsed.description || undefined,
        defaultPriceCents: parsed.defaultPriceCents ?? undefined,
        tjmCents: parsed.tjmCents ?? undefined,
        durationHours: parsed.durationHours ?? undefined,
        vatRate: parsed.vatRate ?? undefined,
        taskTemplates: parsed.templates.length
          ? {
              create: parsed.templates.map((tpl) => ({
                phase: tpl.phase ?? undefined,
                title: tpl.title,
                defaultAssigneeRole: tpl.defaultAssigneeRole || undefined,
                defaultDueOffsetDays: tpl.defaultDueOffsetDays ?? undefined,
              })),
            }
          : undefined,
      },
      include: { taskTemplates: true },
    });

    return NextResponse.json(
      {
        id: created.id.toString(),
        businessId: created.businessId.toString(),
        code: created.code,
        name: created.name,
        type: created.type,
        description: created.description,
        defaultPriceCents: created.defaultPriceCents?.toString() ?? null,
        tjmCents: created.tjmCents?.toString() ?? null,
        durationHours: created.durationHours,
        vatRate: created.vatRate,
        taskTemplates: created.taskTemplates.map((tpl) => ({
          id: tpl.id.toString(),
          phase: tpl.phase,
          title: tpl.title,
          defaultAssigneeRole: tpl.defaultAssigneeRole,
          defaultDueOffsetDays: tpl.defaultDueOffsetDays,
        })),
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return withRequestId(badRequest('Création impossible.'), requestId);
  }
}
