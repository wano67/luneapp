'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import Link from 'next/link';

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
  sousTraitanceCents: string;
  personnelCents: string;
  masseSalarialeBruteCents: number;
  chargesPatronalesEstimCents: number;
  coutEmployeurTotalCents: number;
  effectif: number;
  cfeCents: number;
  cvaeCents: number;
  chargesParGroupe: Array<{ group: string; totalCents: string; count: number }>;
  revenusParGroupe: Array<{ group: string; totalCents: string; count: number }>;
  evolution: Array<{ month: string; revenusCents: string; chargesCents: string; resultatCents: string }>;
};

function kpi(cents: string | number) {
  return formatCents(Number(cents));
}

export function DashboardPanel({ businessId }: { businessId: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedKey, setFetchedKey] = useState('');
  const currentKey = `${businessId}:${year}`;
  const loading = fetchedKey !== currentKey;

  useEffect(() => {
    let cancelled = false;
    fetchJson<DashboardData>(
      `/api/pro/businesses/${businessId}/accounting/dashboard?year=${year}`
    ).then(res => {
      if (cancelled) return;
      setFetchedKey(`${businessId}:${year}`);
      if (res.ok && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error ?? 'Impossible de charger le dashboard.');
        setData(null);
      }
    });
    return () => { cancelled = true; };
  }, [businessId, year]);

  const resultatNum = data ? Number(data.resultatCents) : 0;
  const tvaNette = data ? Number(data.tvaNetteCents) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">Exercice :</span>
        <Select className="w-28" value={year} onChange={(e) => setYear(e.target.value)}>
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--text-secondary)]">Chargement...</p> : null}

      {!loading && data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Chiffre d&apos;affaires HT</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi(data.chiffreAffairesCents)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Charges totales</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi(data.totalChargesCents)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Resultat</p>
              <p className={`text-lg font-semibold ${resultatNum >= 0 ? 'text-emerald-600' : 'text-[var(--danger)]'}`}>
                {kpi(data.resultatCents)}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">Revenu net estime</p>
              <p className={`text-lg font-semibold ${data.revenuNetCents >= 0 ? 'text-emerald-600' : 'text-[var(--danger)]'}`}>
                {kpi(data.revenuNetCents)}
              </p>
            </Card>
          </div>

          {/* Financial Synthesis */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Synthese financiere
              </p>
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                {data.legalFormLabel} · {data.taxRegime}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <SynthLine label="Chiffre d'affaires HT" value={kpi(data.chiffreAffairesCents)} isData />
              {data.chargesParGroupe.map((g) => (
                <SynthLine key={g.group} label={g.group} value={`-${kpi(g.totalCents)}`} sub isData />
              ))}
              {data.masseSalarialeBruteCents > 0 && (
                <>
                  <SynthLine label="Masse salariale brute" value={`-${kpi(data.masseSalarialeBruteCents)}`} sub isData />
                  <SynthLine label="Charges patronales" value={`-${kpi(data.chargesPatronalesEstimCents)}`} sub isEstim />
                </>
              )}
              <div className="border-t border-[var(--border)]/40 pt-1" />
              <SynthLine label="Resultat avant impot" value={kpi(data.resultatCents)} bold />
              <SynthLine label={`${data.taxRegime === 'IR' ? 'IR' : 'IS'} estime (${data.tauxEffectif}%)`} value={`-${kpi(data.estimationImpotCents)}`} sub isEstim />
              {data.cotisationsSocialesCents > 0 && (
                <SynthLine label="Cotisations sociales" value={`-${kpi(data.cotisationsSocialesCents)}`} sub isEstim />
              )}
              {(data.cfeCents > 0 || data.cvaeCents > 0) && (
                <SynthLine label="CFE/CVAE" value={`-${kpi(data.cfeCents + data.cvaeCents)}`} sub isEstim />
              )}
              <div className="border-t border-[var(--border)]/40 pt-1" />
              <SynthLine label="Revenu net estime" value={kpi(data.revenuNetCents)} bold highlight={data.revenuNetCents >= 0} />
            </div>

            {Number(data.sousTraitanceCents) > 0 && (
              <div className="mt-3 rounded-lg bg-[var(--surface)]/50 p-2 text-xs text-[var(--text-secondary)]">
                Dont sous-traitance : {kpi(data.sousTraitanceCents)}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--text-secondary)]">
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Donnees reelles</span>
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> Estimation</span>
            </div>
          </Card>

          {/* TVA */}
          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">TVA</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Regime TVA</span>
                <span className="font-medium">{data.vatRegimeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">TVA collectee</span>
                <span className="font-medium">{kpi(data.tvaCollecteeCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">TVA deductible</span>
                <span className="font-medium">{kpi(data.tvaDeductibleCents)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border)]/40 pt-1.5">
                <span className="text-[var(--text-secondary)]">TVA nette</span>
                <span className={`font-semibold ${tvaNette >= 0 ? '' : 'text-emerald-600'}`}>
                  {tvaNette >= 0 ? `${kpi(data.tvaNetteCents)} a payer` : `${kpi(String(-tvaNette))} credit`}
                </span>
              </div>
            </div>
          </Card>

          {/* Monthly evolution */}
          {data.evolution.length > 0 ? (
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Evolution mensuelle
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
                        <div className="h-4 rounded bg-emerald-500/70" style={{ width: `${(rev / max) * 50}%` }} title={`Revenus: ${formatCents(rev)}`} />
                        <div className="h-4 rounded bg-red-400/70" style={{ width: `${(chg / max) * 50}%` }} title={`Charges: ${formatCents(chg)}`} />
                      </div>
                      <span className="w-20 text-right text-[var(--text-primary)]">{formatCents(Number(m.resultatCents))}</span>
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

          {/* Charges & Revenue breakdown */}
          <div className="grid gap-3 md:grid-cols-2">
            {data.chargesParGroupe.length > 0 ? (
              <Card className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                  Repartition des charges
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
                  Repartition des revenus
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

          {/* Masse salariale */}
          {data.effectif > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Masse salariale ({data.effectif} employe{data.effectif > 1 ? 's' : ''})
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Salaires bruts (mensuel)</span>
                  <span className="font-medium">{kpi(data.masseSalarialeBruteCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Charges patronales estimees</span>
                  <span className="font-medium text-amber-600">{kpi(data.chargesPatronalesEstimCents)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)]/40 pt-1.5">
                  <span className="text-[var(--text-secondary)]">Cout employeur total</span>
                  <span className="font-semibold">{kpi(data.coutEmployeurTotalCents)}</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-secondary)]">
                Base sur les salaires bruts renseignes dans les profils employes.
                <Link href={`/app/pro/${businessId}/team`} className="ml-1 underline">Gerer l&apos;equipe</Link>
              </p>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function SynthLine({ label, value, sub, bold, isData, isEstim, highlight }: {
  label: string;
  value: string;
  sub?: boolean;
  bold?: boolean;
  isData?: boolean;
  isEstim?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${sub ? 'pl-3' : ''}`}>
      <span className={`flex items-center gap-1.5 ${bold ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} ${sub ? 'text-xs' : 'text-sm'}`}>
        {isData && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
        {isEstim && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
        {label}
      </span>
      <span className={`${bold ? 'font-semibold' : 'font-medium'} ${highlight ? 'text-emerald-600' : ''} ${sub ? 'text-xs' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  );
}
