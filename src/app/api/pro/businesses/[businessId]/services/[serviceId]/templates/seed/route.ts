import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { TaskPhase } from '@/generated/prisma';

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

function forbidden(requestId: string) {
  return withIdNoStore(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), requestId);
}

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true } });
}

type SeedTemplate = {
  phase: TaskPhase;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

const STANDARD_PACK: SeedTemplate[] = [
  { phase: 'CADRAGE', title: 'Kickoff et objectifs', defaultAssigneeRole: 'PM', defaultDueOffsetDays: 0 },
  { phase: 'UX', title: 'Interviews utilisateurs', defaultAssigneeRole: 'UX', defaultDueOffsetDays: 5 },
  { phase: 'DESIGN', title: 'Wireframes clés', defaultAssigneeRole: 'Design', defaultDueOffsetDays: 10 },
  { phase: 'DEV', title: 'Setup technique & CI', defaultAssigneeRole: 'Lead Dev', defaultDueOffsetDays: 12 },
  { phase: 'SEO', title: 'Checklist SEO', defaultAssigneeRole: 'SEO', defaultDueOffsetDays: 18 },
  { phase: 'LAUNCH', title: 'Recette & go-live', defaultAssigneeRole: 'Ops', defaultDueOffsetDays: 25 },
  { phase: 'FOLLOW_UP', title: 'Suivi post-lancement', defaultAssigneeRole: 'CSM', defaultDueOffsetDays: 30 },
];

// POST /api/pro/businesses/{businessId}/services/{serviceId}/templates/seed
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
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

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) {
    return withIdNoStore(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:services:templates:seed:${businessIdBigInt}:${serviceIdBigInt}`,
    limit: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.serviceTaskTemplate.findMany({
      where: { serviceId: serviceIdBigInt, service: { businessId: businessIdBigInt } },
      select: { title: true, phase: true },
    });
    const existingKeys = new Set(existing.map((tpl) => `${tpl.phase ?? ''}|${tpl.title.toLowerCase()}`));

    const toCreate = STANDARD_PACK.filter((tpl) => {
      const key = `${tpl.phase ?? ''}|${tpl.title.toLowerCase()}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    }).map((tpl) => ({
      serviceId: serviceIdBigInt,
      phase: tpl.phase,
      title: tpl.title,
      defaultAssigneeRole: tpl.defaultAssigneeRole ?? undefined,
      defaultDueOffsetDays: tpl.defaultDueOffsetDays ?? undefined,
    }));

    if (toCreate.length) {
      await tx.serviceTaskTemplate.createMany({ data: toCreate, skipDuplicates: true });
    }

    return { createdCount: toCreate.length, skippedCount: STANDARD_PACK.length - toCreate.length };
  });

  return withIdNoStore(jsonNoStore(result), requestId);
}
