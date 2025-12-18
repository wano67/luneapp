import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import type { TaskPhase } from '@/generated/prisma/client';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

// POST /api/pro/businesses/{businessId}/projects/{projectId}/start
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
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

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withRequestId(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden();

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    include: {
      projectServices: { include: { service: { include: { taskTemplates: true } } } },
    },
  });
  if (!project) {
    return withRequestId(NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 }), requestId);
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
    return withRequestId(badRequest('Le devis doit être signé/accepté avant démarrage.'), requestId);
  }
  if (!(project.depositStatus === 'PAID' || project.depositStatus === 'NOT_REQUIRED')) {
    return withRequestId(badRequest('L’acompte doit être payé ou non requis.'), requestId);
  }

  const now = new Date();
  const tasksToCreate: {
    title: string;
    phase: TaskPhase | null;
    projectId: bigint;
    businessId: bigint;
    status: string;
    dueDate?: Date;
  }[] = [];

  for (const ps of project.projectServices) {
    for (const tpl of ps.service.taskTemplates) {
      const dueDate = tpl.defaultDueOffsetDays != null ? new Date(now.getTime() + tpl.defaultDueOffsetDays * 86400000) : undefined;
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

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectIdBigInt },
      data: { startedAt: now, status: 'ACTIVE' },
    });

    let createdCount = 0;
    if (tasksToCreate.length) {
      await tx.task.createMany({
        data: tasksToCreate.map((t) => ({
          title: t.title,
          phase: t.phase ?? undefined,
          projectId: t.projectId,
          businessId: t.businessId,
          status: t.status as 'TODO' | 'IN_PROGRESS' | 'DONE',
          dueDate: t.dueDate,
        })),
        skipDuplicates: true,
      });
      createdCount = tasksToCreate.length;
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
