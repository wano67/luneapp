import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { parseDateOpt } from '@/server/http/parsers';
import {
  estimateFiscal,
  determineVatRegime,
  estimateCFE,
  estimateCVAE,
  computeChargesPatronales,
  computeDirigeantCost,
  type BusinessLegalForm,
  type TaxRegime,
  type SocialRegimeType,
  LEGAL_FORM_LABELS,
  VAT_REGIME_LABELS,
} from '@/config/taxation';

// GET /api/pro/businesses/{businessId}/accounting/dashboard?year=2026 or ?from=...&to=...
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);

    const yearParam = searchParams.get('year');
    let fromDate = parseDateOpt(searchParams.get('from'));
    let toDate = parseDateOpt(searchParams.get('to'));

    if (!fromDate && !toDate && yearParam) {
      const year = Number.parseInt(yearParam, 10);
      if (Number.isFinite(year)) {
        fromDate = new Date(year, 0, 1);
        toDate = new Date(year, 11, 31, 23, 59, 59);
      }
    }

    const dateFilter = fromDate || toDate
      ? { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) }
      : undefined;

    const resolvedYear = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();

    // Load business info + employee salaries + associates + goals in parallel
    const [business, finances, employees, associates, goals] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessIdBigInt },
        select: { legalForm: true, taxRegime: true, activityType: true, socialRegime: true, capital: true },
      }),
      prisma.finance.findMany({
        where: {
          businessId: businessIdBigInt,
          deletedAt: null,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        select: {
          type: true,
          amountCents: true,
          accountCode: true,
          vatRate: true,
          vatCents: true,
          date: true,
        },
      }),
      prisma.employeeProfile.findMany({
        where: {
          membership: { businessId: businessIdBigInt },
          status: 'ACTIVE',
          grossSalaryCents: { not: null },
        },
        select: { grossSalaryCents: true },
      }),
      prisma.businessAssociate.findMany({
        where: { businessId: businessIdBigInt },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.businessGoal.findMany({
        where: { businessId: businessIdBigInt, year: Number.isFinite(resolvedYear) ? resolvedYear : new Date().getFullYear() },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const legalForm = (business?.legalForm ?? 'SAS') as BusinessLegalForm;
    const taxRegime = (business?.taxRegime ?? (legalForm === 'MICRO' ? 'IR' : 'IS')) as TaxRegime;
    const activityType = business?.activityType;
    const isVente = activityType === 'COMMERCE';

    let totalRevenueCents = 0n;
    let totalChargeCents = 0n;
    let tvaCollecteeCents = 0n;
    let tvaDeductibleCents = 0n;
    let sousTraitanceCents = 0n;
    let personnelCents = 0n;

    const chargesParGroupe = new Map<string, { total: bigint; count: number }>();
    const revenusParGroupe = new Map<string, { total: bigint; count: number }>();
    const monthlyMap = new Map<string, { revenus: bigint; charges: bigint }>();

    for (const f of finances) {
      const monthKey = `${f.date.getFullYear()}-${String(f.date.getMonth() + 1).padStart(2, '0')}`;
      let monthly = monthlyMap.get(monthKey);
      if (!monthly) {
        monthly = { revenus: 0n, charges: 0n };
        monthlyMap.set(monthKey, monthly);
      }

      if (f.type === 'INCOME') {
        totalRevenueCents += f.amountCents;
        monthly.revenus += f.amountCents;
        if (f.vatCents) tvaCollecteeCents += f.vatCents;

        const group = getGroupForCode(f.accountCode) ?? 'Autres revenus';
        const existing = revenusParGroupe.get(group);
        if (existing) { existing.total += f.amountCents; existing.count++; }
        else revenusParGroupe.set(group, { total: f.amountCents, count: 1 });
      } else {
        totalChargeCents += f.amountCents;
        monthly.charges += f.amountCents;
        if (f.vatCents) tvaDeductibleCents += f.vatCents;

        // Track sous-traitance (611, 6411)
        if (f.accountCode?.startsWith('611') || f.accountCode?.startsWith('6411')) {
          sousTraitanceCents += f.amountCents;
        }
        // Track personnel (641, 645)
        if (f.accountCode?.startsWith('641') || f.accountCode?.startsWith('645')) {
          personnelCents += f.amountCents;
        }

        const group = getGroupForCode(f.accountCode) ?? 'Autres charges';
        const existing = chargesParGroupe.get(group);
        if (existing) { existing.total += f.amountCents; existing.count++; }
        else chargesParGroupe.set(group, { total: f.amountCents, count: 1 });
      }
    }

    const resultatCents = totalRevenueCents - totalChargeCents;
    const tvaNetteCents = tvaCollecteeCents - tvaDeductibleCents;

    // Fiscal estimation
    const caEuros = Number(totalRevenueCents) / 100;
    const chargesEuros = Number(totalChargeCents) / 100;
    const fiscal = estimateFiscal({
      legalForm,
      taxRegime,
      ca: caEuros,
      charges: chargesEuros,
      isVente,
      microActivite: activityType === 'LIBERALE' ? 'BNC' : (isVente ? 'VENTE' : 'SERVICES_BIC'),
    });
    const vatRegimeDetecte = determineVatRegime(caEuros, isVente);

    // CFE/CVAE estimation
    const cfeCents = Math.round(estimateCFE(caEuros) * 100);
    const valeurAjoutee = caEuros - chargesEuros;
    const cvaeCents = Math.round(estimateCVAE(caEuros, Math.max(0, valeurAjoutee)) * 100);

    // Masse salariale from employee profiles
    let masseSalarialeBruteCents = 0;
    let chargesPatronalesEstimCents = 0;
    const effectif = employees.length;
    for (const emp of employees) {
      if (!emp.grossSalaryCents) continue;
      const grossCents = Number(emp.grossSalaryCents);
      masseSalarialeBruteCents += grossCents;
      const grossEuros = grossCents / 100;
      const charges = computeChargesPatronales(grossEuros, effectif);
      chargesPatronalesEstimCents += Math.round(charges.total * 100);
    }

    // Monthly evolution sorted
    const evolution = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenusCents: data.revenus.toString(),
        chargesCents: data.charges.toString(),
        resultatCents: (data.revenus - data.charges).toString(),
      }));

    // Associates cost computation
    const socialRegime = (business?.socialRegime ?? 'ASSIMILE_SALARIE') as SocialRegimeType;
    const capitalCents = business?.capital ?? 0;
    let coutDirigeantTotalCents = 0;
    const associatesData = associates.map((a) => {
      const cost = computeDirigeantCost({
        grossSalaryYearlyCents: Number(a.grossSalaryYearlyCents),
        dividendsCents: Number(a.dividendsCents),
        legalForm,
        socialRegime,
        capitalCents,
        ccaCents: Number(a.ccaCents),
        effectif,
      });
      if (a.isLeader) coutDirigeantTotalCents += cost.coutTotalDirigeantCents;
      return {
        id: a.id.toString(),
        name: a.name,
        role: a.role,
        isLeader: a.isLeader,
        sharePercent: Number(a.sharePercent),
        coutTotal: cost.coutTotalDirigeantCents,
        revenuNet: cost.revenuNetTotalCents,
      };
    });

    // Goals progress
    const resultatNum = Number(resultatCents) / 100;
    const goalsData = goals.map((g) => {
      const targetCents = Number(g.targetCents);
      let currentCents = 0;
      switch (g.metric) {
        case 'CA_HT':
          currentCents = Number(totalRevenueCents);
          break;
        case 'RESULTAT_NET':
          currentCents = Math.round(resultatNum * 100);
          break;
        case 'REVENU_NET_DIRIGEANT':
          currentCents = Math.round(fiscal.revenuNetApresImpots * 100);
          break;
        case 'MARGE_BRUTE':
          currentCents = Number(totalRevenueCents) - Number(totalChargeCents);
          break;
      }
      return {
        id: g.id.toString(),
        name: g.name,
        metric: g.metric,
        targetCents,
        currentCents,
        progressPercent: targetCents > 0 ? Math.round((currentCents / targetCents) * 10000) / 100 : 0,
      };
    });

    return jsonb(
      {
        chiffreAffairesCents: totalRevenueCents.toString(),
        totalChargesCents: totalChargeCents.toString(),
        resultatCents: resultatCents.toString(),
        tvaCollecteeCents: tvaCollecteeCents.toString(),
        tvaDeductibleCents: tvaDeductibleCents.toString(),
        tvaNetteCents: tvaNetteCents.toString(),
        legalFormLabel: LEGAL_FORM_LABELS[legalForm] ?? legalForm,
        taxRegime,
        vatRegime: vatRegimeDetecte,
        vatRegimeLabel: VAT_REGIME_LABELS[vatRegimeDetecte],
        estimationImpotCents: Math.round(fiscal.impot * 100),
        tauxEffectif: Math.round(fiscal.tauxEffectif * 100) / 100,
        cotisationsSocialesCents: Math.round(fiscal.cotisationsSociales * 100),
        revenuNetCents: Math.round(fiscal.revenuNetApresImpots * 100),
        // New fields
        sousTraitanceCents: sousTraitanceCents.toString(),
        personnelCents: personnelCents.toString(),
        masseSalarialeBruteCents,
        chargesPatronalesEstimCents,
        coutEmployeurTotalCents: masseSalarialeBruteCents + chargesPatronalesEstimCents,
        effectif,
        cfeCents,
        cvaeCents,
        chargesParGroupe: Array.from(chargesParGroupe.entries())
          .map(([group, data]) => ({ group, totalCents: data.total.toString(), count: data.count }))
          .sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents))),
        revenusParGroupe: Array.from(revenusParGroupe.entries())
          .map(([group, data]) => ({ group, totalCents: data.total.toString(), count: data.count }))
          .sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents))),
        evolution,
        associates: associatesData,
        coutDirigeantTotalCents,
        goals: goalsData,
      },
      requestId
    );
  }
);

function getGroupForCode(code: string | null): string | null {
  if (!code) return null;
  const prefix = code.slice(0, 2);
  const groupMap: Record<string, string> = {
    '60': 'Achats',
    '61': 'Services exterieurs',
    '62': 'Autres services',
    '63': 'Impots & taxes',
    '64': 'Personnel & sous-traitance',
    '65': 'Autres charges',
    '66': 'Charges financieres',
    '69': 'Impots sur benefices',
    '70': 'Ventes',
    '74': 'Autres produits',
    '75': 'Autres produits',
    '76': 'Produits financiers',
    '77': 'Produits exceptionnels',
  };
  return groupMap[prefix] ?? null;
}
