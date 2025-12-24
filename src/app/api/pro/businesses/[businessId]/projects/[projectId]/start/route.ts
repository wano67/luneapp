import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import type { TaskPhase } from '@/generated/prisma/client';

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

// POST /api/pro/businesses/{businessId}/projects/{projectId}/start
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
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

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:projects:start:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    include: {
      projectServices: { include: { service: { include: { taskTemplates: true } } } },
    },
  });
  if (!project) {
    return withIdNoStore(notFound('Projet introuvable.'), requestId);
  }

  if (project.archivedAt) {
    return withIdNoStore(badRequest('Projet archivé : démarrage impossible.'), requestId);
  }

  if (project.startedAt) {
    return withNoStore(
      withRequestId(
        NextResponse.json({ startedAt: project.startedAt.toISOString(), tasksCreated: 0 }, { status: 200 }),
        requestId
      )
    );
  }

  if (!(project.quoteStatus === 'SIGNED' || project.quoteStatus === 'ACCEPTED')) {
    return withNoStore(
      withRequestId(badRequest('Le devis doit être signé/accepté avant démarrage.'), requestId)
    );
  }
  if (!(project.depositStatus === 'PAID' || project.depositStatus === 'NOT_REQUIRED')) {
    return withNoStore(
      withRequestId(badRequest('L’acompte doit être payé ou non requis.'), requestId)
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existingTasks = await tx.task.findMany({
      where: { projectId: projectIdBigInt, businessId: businessIdBigInt },
      select: { title: true, phase: true },
    });
    const existingKeys = new Set(existingTasks.map((t) => `${t.title}|${t.phase ?? ''}`));

    const tasksToCreate: {
      title: string;
      phase: TaskPhase | null;
      projectId: bigint;
      businessId: bigint;
      status: 'TODO' | 'IN_PROGRESS' | 'DONE';
      dueDate?: Date;
    }[] = [];

    for (const ps of project.projectServices) {
      for (const tpl of ps.service.taskTemplates) {
        const dueDate =
          tpl.defaultDueOffsetDays != null ? new Date(now.getTime() + tpl.defaultDueOffsetDays * 86400000) : undefined;
        const key = `${tpl.title}|${tpl.phase ?? ''}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        tasksToCreate.push({
          title: tpl.title,
          phase: (tpl.phase ?? null) as TaskPhase | null,
          projectId: projectIdBigInt,
          businessId: businessIdBigInt,
          status: 'TODO',
          dueDate,
        });
      }
    }

    const updated = await tx.project.update({
      where: { id: projectIdBigInt },
      data: { startedAt: now, status: 'ACTIVE' },
    });

    let createdCount = 0;
    if (tasksToCreate.length) {
      const created = await tx.task.createMany({
        data: tasksToCreate,
        skipDuplicates: true,
      });
      createdCount = created.count;
    }

    return { startedAt: updated.startedAt!, tasksCreated: createdCount };
  });

  return withNoStore(
    withRequestId(
      NextResponse.json(
        {
          startedAt: result.startedAt.toISOString(),
          tasksCreated: result.tasksCreated,
        },
        { status: 200 }
      ),
      requestId
    )
  );
}
