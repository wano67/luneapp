import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/client';

type SeedResult = {
  userId: string;
  businessId: string;
  serviceId: string | null;
  prospectId: string | null;
};

export async function runDevSeed(): Promise<SeedResult> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed dev interdit en production.');
  }
  if (process.env.ENABLE_DEV_SEED !== '1') {
    throw new Error('ENABLE_DEV_SEED=1 requis pour le seed dev.');
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
    (await prisma.business.create({
      data: { name: businessName, ownerId: user.id },
    }));

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

  return {
    userId: user.id.toString(),
    businessId: business.id.toString(),
    serviceId: service?.id?.toString() ?? null,
    prospectId: prospect?.id?.toString() ?? null,
  };
}
