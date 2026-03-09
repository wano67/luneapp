import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { parseDateOpt } from '@/server/http/parsers';
import {
  estimateFiscal,
  determineVatRegime,
  type BusinessLegalForm,
  type TaxRegime,
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

    // Load business legal form
    const business = await prisma.business.findUnique({
      where: { id: businessIdBigInt },
      select: { legalForm: true, taxRegime: true },
    });
    const legalForm = (business?.legalForm ?? 'SAS') as BusinessLegalForm;
    const taxRegime = (business?.taxRegime ?? (legalForm === 'MICRO' ? 'IR' : 'IS')) as TaxRegime;

    const finances = await prisma.finance.findMany({
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
    });

    let totalRevenueCents = 0n;
    let totalChargeCents = 0n;
    let tvaCollecteeCents = 0n;
    let tvaDeductibleCents = 0n;

    const chargesParGroupe = new Map<string, { total: bigint; count: number }>();
    const revenusParGroupe = new Map<string, { total: bigint; count: number }>();

    // Monthly evolution
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

        // Group
        const group = getGroupForCode(f.accountCode) ?? 'Autres revenus';
        const existing = revenusParGroupe.get(group);
        if (existing) { existing.total += f.amountCents; existing.count++; }
        else revenusParGroupe.set(group, { total: f.amountCents, count: 1 });
      } else {
        totalChargeCents += f.amountCents;
        monthly.charges += f.amountCents;
        if (f.vatCents) tvaDeductibleCents += f.vatCents;

        const group = getGroupForCode(f.accountCode) ?? 'Autres charges';
        const existing = chargesParGroupe.get(group);
        if (existing) { existing.total += f.amountCents; existing.count++; }
        else chargesParGroupe.set(group, { total: f.amountCents, count: 1 });
      }
    }

    const resultatCents = totalRevenueCents - totalChargeCents;
    const tvaNetteCents = tvaCollecteeCents - tvaDeductibleCents;

    // Estimation fiscale selon le type de société
    const caEuros = Number(totalRevenueCents) / 100;
    const chargesEuros = Number(totalChargeCents) / 100;
    const fiscal = estimateFiscal({
      legalForm,
      taxRegime,
      ca: caEuros,
      charges: chargesEuros,
    });
    const estimationImpot = fiscal.impot;
    const tauxEffectif = fiscal.tauxEffectif;
    const cotisationsSociales = fiscal.cotisationsSociales;
    const vatRegimeDetecte = determineVatRegime(caEuros, true);

    // Monthly evolution sorted
    const evolution = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenusCents: data.revenus.toString(),
        chargesCents: data.charges.toString(),
        resultatCents: (data.revenus - data.charges).toString(),
      }));

    return jsonb(
      {
        chiffreAffairesCents: totalRevenueCents.toString(),
        totalChargesCents: totalChargeCents.toString(),
        resultatCents: resultatCents.toString(),
        tvaCollecteeCents: tvaCollecteeCents.toString(),
        tvaDeductibleCents: tvaDeductibleCents.toString(),
        tvaNetteCents: tvaNetteCents.toString(),
        legalFormLabel: LEGAL_FORM_LABELS[legalForm],
        taxRegime,
        vatRegime: vatRegimeDetecte,
        vatRegimeLabel: VAT_REGIME_LABELS[vatRegimeDetecte],
        estimationImpotCents: Math.round(estimationImpot * 100),
        tauxEffectif: Math.round(tauxEffectif * 100) / 100,
        cotisationsSocialesCents: Math.round(cotisationsSociales * 100),
        revenuNetCents: Math.round(fiscal.revenuNetApresImpots * 100),
        chargesParGroupe: Array.from(chargesParGroupe.entries())
          .map(([group, data]) => ({ group, totalCents: data.total.toString(), count: data.count }))
          .sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents))),
        revenusParGroupe: Array.from(revenusParGroupe.entries())
          .map(([group, data]) => ({ group, totalCents: data.total.toString(), count: data.count }))
          .sort((a, b) => Number(BigInt(b.totalCents) - BigInt(a.totalCents))),
        evolution,
      },
      requestId
    );
  }
);

// Simple helper to get PCG group from account code
function getGroupForCode(code: string | null): string | null {
  if (!code) return null;
  // Import would create circular dep in some setups, so inline the logic
  const prefix = code.slice(0, 2);
  const groupMap: Record<string, string> = {
    '60': 'Achats',
    '61': 'Services extérieurs',
    '62': 'Autres services',
    '63': 'Impôts & taxes',
    '64': 'Personnel & sous-traitance',
    '65': 'Autres charges',
    '66': 'Charges financières',
    '69': 'Impôts sur bénéfices',
    '70': 'Ventes',
    '74': 'Autres produits',
    '75': 'Autres produits',
    '76': 'Produits financiers',
    '77': 'Produits exceptionnels',
  };
  return groupMap[prefix] ?? null;
}
