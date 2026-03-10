import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { computeChargesPatronales, computeNetFromGross } from '@/config/taxation';

// GET /api/pro/businesses/{businessId}/team/payroll
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'ADMIN' },
  async (ctx) => {
    const employees = await prisma.employeeProfile.findMany({
      where: {
        membership: { businessId: ctx.businessId },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        jobTitle: true,
        contractType: true,
        contractTypeEnum: true,
        weeklyHours: true,
        grossSalaryCents: true,
        hourlyCostCents: true,
        membership: {
          select: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    const effectif = employees.length;
    let totalBrutCents = 0;
    let totalChargesPatronalesCents = 0;
    let totalCoutEmployeurCents = 0;
    let totalNetEstimeCents = 0;

    const items = employees.map((emp) => {
      const grossCents = emp.grossSalaryCents ? Number(emp.grossSalaryCents) : 0;
      const grossEuros = grossCents / 100;
      const chargesDetail = grossCents > 0 ? computeChargesPatronales(grossEuros, effectif) : null;
      const chargesPatronalesCents = chargesDetail ? Math.round(chargesDetail.total * 100) : 0;
      const coutEmployeurCents = grossCents + chargesPatronalesCents;
      const netEstimeCents = grossCents > 0 ? Math.round(computeNetFromGross(grossEuros) * 100) : 0;

      totalBrutCents += grossCents;
      totalChargesPatronalesCents += chargesPatronalesCents;
      totalCoutEmployeurCents += coutEmployeurCents;
      totalNetEstimeCents += netEstimeCents;

      return {
        id: emp.id.toString(),
        name: emp.membership.user.name ?? emp.membership.user.email,
        jobTitle: emp.jobTitle,
        contractType: emp.contractTypeEnum ?? emp.contractType,
        weeklyHours: emp.weeklyHours,
        grossSalaryCents: grossCents.toString(),
        chargesPatronalesCents: chargesPatronalesCents.toString(),
        coutEmployeurCents: coutEmployeurCents.toString(),
        netEstimeCents: netEstimeCents.toString(),
        chargesDetail: chargesDetail ? {
          maladie: Math.round(chargesDetail.maladie * 100),
          vieillessePlafonnee: Math.round(chargesDetail.vieillessePlafonnee * 100),
          vieillesseDeplafonnee: Math.round(chargesDetail.vieillesseDeplafonnee * 100),
          retraiteCompT1: Math.round(chargesDetail.retraiteCompT1 * 100),
          retraiteCompT2: Math.round(chargesDetail.retraiteCompT2 * 100),
          assuranceChomage: Math.round(chargesDetail.assuranceChomage * 100),
          ags: Math.round(chargesDetail.ags * 100),
          accidentTravail: Math.round(chargesDetail.accidentTravail * 100),
          formationPro: Math.round(chargesDetail.formationPro * 100),
          taxeApprentissage: Math.round(chargesDetail.taxeApprentissage * 100),
          mutuellePatronale: Math.round(chargesDetail.mutuellePatronale * 100),
        } : null,
      };
    });

    return jsonb({
      employees: items,
      totals: {
        totalBrutCents: totalBrutCents.toString(),
        totalChargesPatronalesCents: totalChargesPatronalesCents.toString(),
        totalCoutEmployeurCents: totalCoutEmployeurCents.toString(),
        totalNetEstimeCents: totalNetEstimeCents.toString(),
      },
      effectif,
    }, ctx.requestId);
  }
);
