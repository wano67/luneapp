import 'dotenv/config';
import { prisma } from '../src/server/db/client';
import { buildProjectWhere, getProjectCounts, type ProjectScope } from '../src/server/queries/projects';

const businessId = process.env.TEST_BUSINESS_ID || process.argv[2];

async function main() {
  if (!businessId) {
    console.log('Usage: TEST_BUSINESS_ID=123 pnpm tsx scripts/test-project-counts.ts');
    return;
  }

  const counts = await getProjectCounts({ businessId });
  const scopeCounts: Record<ProjectScope, number> = {
    ACTIVE: counts.active,
    PLANNED: counts.planned,
    INACTIVE: counts.inactive,
    ALL: counts.total,
  };

  const scopes: ProjectScope[] = ['ACTIVE', 'PLANNED', 'INACTIVE', 'ALL'];

  for (const scope of scopes) {
    const where = buildProjectWhere({ businessId, scope, includeArchived: scope === 'ALL' });
    const [count, items] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({ where, select: { id: true } }),
    ]);

    if (count !== scopeCounts[scope]) {
      throw new Error(`Scope ${scope}: expected ${scopeCounts[scope]} from getProjectCounts, got ${count}`);
    }

    if (items.length !== count) {
      throw new Error(`Scope ${scope}: list length ${items.length} does not match count ${count}`);
    }
  }

  console.log('Project count checks: OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
