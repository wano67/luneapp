import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL manquant : impossible de seeder.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusé : seed dev indisponible en production.');
    process.exit(1);
  }
  if (process.env.ENABLE_DEV_SEED !== '1') {
    console.error('Refusé : définir ENABLE_DEV_SEED=1 pour lancer le seed dev.');
    process.exit(1);
  }

  const email = 'admin@local.test';
  const password = 'admintest';
  const businessName = 'Studio Fief Dev';

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        name: 'Admin Dev',
        isActive: true,
      },
    }));

  const business =
    (await prisma.business.findFirst({ where: { name: businessName } })) ??
    (await prisma.business.create({ data: { name: businessName, ownerId: user.id } }));

  await prisma.businessMembership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    create: { businessId: business.id, userId: user.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });

  const service =
    (await prisma.service.findFirst({
      where: { businessId: business.id, code: 'SER-DEV' },
      include: { taskTemplates: true },
    })) ??
    (await prisma.service.create({
      data: {
        businessId: business.id,
        code: 'SER-DEV',
        name: 'Service démo',
        type: 'SITE',
        defaultPriceCents: 150000,
        taskTemplates: {
          create: [
            {
              phase: 'CADRAGE',
              title: 'Kickoff',
              defaultAssigneeRole: 'PM',
              defaultDueOffsetDays: 0,
            },
          ],
        },
      },
      include: { taskTemplates: true },
    }));

  const prospect =
    (await prisma.prospect.findFirst({
      where: { businessId: business.id, name: 'Prospect Démo' },
    })) ??
    (await prisma.prospect.create({
      data: {
        businessId: business.id,
        name: 'Prospect Démo',
        title: 'CTO',
        contactEmail: 'cto@demo.test',
        pipelineStatus: 'IN_DISCUSSION',
        probability: 60,
      },
    }));

  console.log(
    JSON.stringify(
      {
        userId: user.id.toString(),
        businessId: business.id.toString(),
        serviceId: service?.id?.toString() ?? null,
        prospectId: prospect?.id?.toString() ?? null,
      },
      null,
      2
    )
  );
}

void main()
  .catch((err) => {
    console.error('Seed dev échec:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
