'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';

type DashboardData = {
  chiffreAffairesCents: string;
  totalChargesCents: string;
  resultatCents: string;
  tvaCollecteeCents: string;
  tvaDeductibleCents: string;
  tvaNetteCents: string;
  legalFormLabel: string;
  taxRegime: string;
  vatRegime: string;
  vatRegimeLabel: string;
  estimationImpotCents: number;
  tauxEffectif: number;
  cotisationsSocialesCents: number;
  revenuNetCents: number;
  chargesParGroupe: Array<{ group: string; totalCents: string; count: number }>;
  revenusParGroupe: Array<{ group: string; totalCents: string; count: number }>;
  evolution: Array<{ month: string; revenusCents: string; chargesCents: string; resultatCents: string }>;
};

function kpi(cents: string) {
  return formatCents(Number(cents));
}

export function DashboardPanel({ businessId }: { businessId: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<DashboardData>(
      `/api/pro/businesses/${businessId}/accounting/dashboard?year=${year}`
    );
    setLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Impossible de charger le dashboard.');
      setData(null);
      return;
    }
    setData(res.data);
  }, [businessId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const resultatNum = data ? Number(data.resultatCents) : 0;
  const tvaNette = data ? Number(data.tvaNetteCents) : 0;

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">Exercice :</span>
        <Select
          className="w-28"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--text-secondary)]">Chargement…</p> : null}

      {!loading && data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Chiffre d&apos;affaires</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi(data.chiffreAffairesCents)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Charges</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi(data.totalChargesCents)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Résultat</p>
              <p className={`text-lg font-semibold ${resultatNum >= 0 ? 'text-emerald-600' : 'text-[var(--danger)]'}`}>
                {kpi(data.resultatCents)}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">TVA nette</p>
              <p className={`text-lg font-semibold ${tvaNette >= 0 ? 'text-[var(--text-primary)]' : 'text-emerald-600'}`}>
                {tvaNette >= 0 ? `${kpi(data.tvaNetteCents)} à payer` : `${kpi(String(-tvaNette))} crédit`}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                Estimation {data.taxRegime === 'IR' ? 'IR' : 'IS'}
              </p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCents(data.estimationImpotCents)}
                <span className="ml-1 text-xs font-normal text-[var(--text-secondary)]">
                  ({data.tauxEffectif}%)
                </span>
              </p>
            </Card>
          </div>

          {/* Monthly evolution */}
          {data.evolution.length > 0 ? (
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Évolution mensuelle
              </p>
              <div className="space-y-1">
                {data.evolution.map((m) => {
                  const rev = Number(m.revenusCents);
                  const chg = Number(m.chargesCents);
                  const max = Math.max(rev, chg, 1);
                  return (
                    <div key={m.month} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-[var(--text-secondary)]">{m.month}</span>
                      <div className="flex flex-1 gap-1">
                        <div
                          className="h-4 rounded bg-emerald-500/70"
                          style={{ width: `${(rev / max) * 50}%` }}
                          title={`Revenus: ${formatCents(rev)}`}
                        />
                        <div
                          className="h-4 rounded bg-red-400/70"
                          style={{ width: `${(chg / max) * 50}%` }}
                          title={`Charges: ${formatCents(chg)}`}
                        />
                      </div>
                      <span className="w-20 text-right text-[var(--text-primary)]">
                        {formatCents(Number(m.resultatCents))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-[var(--text-secondary)]">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-emerald-500/70" /> Revenus</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-red-400/70" /> Charges</span>
              </div>
            </Card>
          ) : null}

          {/* Charges breakdown */}
          <div className="grid gap-3 md:grid-cols-2">
            {data.chargesParGroupe.length > 0 ? (
              <Card className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                  Répartition des charges
                </p>
                <div className="space-y-1.5">
                  {data.chargesParGroupe.map((g) => {
                    const total = Number(data.totalChargesCents) || 1;
                    const pct = (Number(g.totalCents) / total) * 100;
                    return (
                      <div key={g.group} className="flex items-center gap-2 text-xs">
                        <span className="w-40 truncate text-[var(--text-primary)]">{g.group}</span>
                        <div className="flex-1 rounded-full bg-[var(--surface-2)] h-2.5">
                          <div className="h-2.5 rounded-full bg-red-400/70" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 text-right text-[var(--text-secondary)]">{kpi(g.totalCents)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {data.revenusParGroupe.length > 0 ? (
              <Card className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                  Répartition des revenus
                </p>
                <div className="space-y-1.5">
                  {data.revenusParGroupe.map((g) => {
                    const total = Number(data.chiffreAffairesCents) || 1;
                    const pct = (Number(g.totalCents) / total) * 100;
                    return (
                      <div key={g.group} className="flex items-center gap-2 text-xs">
                        <span className="w-40 truncate text-[var(--text-primary)]">{g.group}</span>
                        <div className="flex-1 rounded-full bg-[var(--surface-2)] h-2.5">
                          <div className="h-2.5 rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 text-right text-[var(--text-secondary)]">{kpi(g.totalCents)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>

          {/* Fiscal + TVA detail */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Fiscalité
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Forme juridique</span>
                  <span className="font-medium">{data.legalFormLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Régime fiscal</span>
                  <span className="font-medium">{data.taxRegime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Estimation {data.taxRegime === 'IR' ? 'IR' : 'IS'}
                  </span>
                  <span className="font-medium">{formatCents(data.estimationImpotCents)}</span>
                </div>
                {data.cotisationsSocialesCents > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Cotisations sociales</span>
                    <span className="font-medium">{formatCents(data.cotisationsSocialesCents)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[var(--border)]/40 pt-1.5">
                  <span className="text-[var(--text-secondary)]">Revenu net estimé</span>
                  <span className={`font-semibold ${data.revenuNetCents >= 0 ? 'text-emerald-600' : 'text-[var(--danger)]'}`}>
                    {formatCents(data.revenuNetCents)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                TVA
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Régime TVA</span>
                  <span className="font-medium">{data.vatRegimeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">TVA collectée</span>
                  <span className="font-medium">{kpi(data.tvaCollecteeCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">TVA déductible</span>
                  <span className="font-medium">{kpi(data.tvaDeductibleCents)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)]/40 pt-1.5">
                  <span className="text-[var(--text-secondary)]">TVA nette</span>
                  <span className={`font-semibold ${tvaNette >= 0 ? '' : 'text-emerald-600'}`}>
                    {tvaNette >= 0 ? `${kpi(data.tvaNetteCents)} à payer` : `${kpi(String(-tvaNette))} crédit`}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
