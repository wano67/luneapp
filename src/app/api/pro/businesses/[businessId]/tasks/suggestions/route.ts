import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

// GET /api/pro/businesses/{businessId}/tasks/suggestions?q=xxx
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return jsonb({ suggestions: [] }, requestId);

    // Search existing tasks and service task templates
    const [tasks, templates] = await Promise.all([
      prisma.task.findMany({
        where: {
          project: { businessId: businessIdBigInt },
          title: { contains: q, mode: 'insensitive' },
        },
        select: { title: true, estimatedMinutes: true, phase: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.serviceTaskTemplate.findMany({
        where: {
          service: { businessId: businessIdBigInt },
          title: { contains: q, mode: 'insensitive' },
        },
        select: { title: true, estimatedMinutes: true, phase: true, createdAt: true },
        take: 50,
      }),
    ]);

    // Deduplicate by lowercase title, keeping the most recent
    const seen = new Map<string, { title: string; estimatedMinutes: number | null; phase: string | null }>();
    for (const t of tasks) {
      const key = t.title.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { title: t.title, estimatedMinutes: t.estimatedMinutes, phase: t.phase });
      }
    }
    for (const t of templates) {
      const key = t.title.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { title: t.title, estimatedMinutes: t.estimatedMinutes, phase: t.phase });
      }
    }

    const suggestions = [...seen.values()].slice(0, 15);
    return jsonb({ suggestions }, requestId);
  }
);
