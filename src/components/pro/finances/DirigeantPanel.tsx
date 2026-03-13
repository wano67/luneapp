'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { useToast } from '@/components/ui/toast';
import { revalidate } from '@/lib/revalidate';
import { Plus, Trash2, Target, Calculator, Users, TrendingUp, Banknote } from 'lucide-react';
import { AssociateFormModal } from './AssociateFormModal';
import { GoalFormModal } from './GoalFormModal';
import { parseEuroToCents } from '@/lib/money';

type Associate = {
  id: string;
  name: string;
  role: string;
  isLeader: boolean;
  sharePercent: number;
  grossSalaryYearlyCents: number;
  dividendsCents: number;
  ccaCents: number;
  nbParts: number;
};

type SimResult = {
  grossSalaryCents: number;
  chargesPatronalesCents: number;
  cotisationsTNSCents: number;
  coutTotalRemunerationCents: number;
  netAvantIRCents: number;
  dividendesBrutsCents: number;
  dividendesTaxCents: number;
  dividendesNetsCents: number;
  coutTotalDirigeantCents: number;
  revenuNetTotalCents: number;
};

type OptimalResult = {
  optimalSalaryCents: number;
  optimalDividendsCents: number;
  netMaxCents: number;
};

type Goal = {
  id: string;
  name: string;
  targetCents: number;
  metric: string;
  year: number;
};

const ROLE_LABELS: Record<string, string> = {
  PRESIDENT: 'President',
  DIRECTEUR_GENERAL: 'Directeur general',
  GERANT_MAJORITAIRE: 'Gerant majoritaire',
  GERANT_MINORITAIRE: 'Gerant minoritaire',
  ASSOCIE: 'Associe',
};

export function DirigeantPanel({ businessId }: { businessId: string }) {
  const toast = useToast();
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [editAssociate, setEditAssociate] = useState<Associate | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  // Simulation
  const [simSalary, setSimSalary] = useState('');
  const [simDividends, setSimDividends] = useState('');
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const simTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Optimization
  const [optBudget, setOptBudget] = useState('');
  const [optResult, setOptResult] = useState<OptimalResult | null>(null);
  const [optLoading, setOptLoading] = useState(false);

  // Finance KPI data per associate
  type FinanceEntry = { category: string; amountCents: number };
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);

  // Versement form per associate
  const [versementForm, setVersementForm] = useState<{
    associateId: string;
    kind: 'salary' | 'dividend';
    amount: string;
    date: string;
  } | null>(null);
  const [versementSaving, setVersementSaving] = useState(false);

  const [fetchKey, setFetchKey] = useState(0);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ items: Associate[] }>(`/api/pro/businesses/${businessId}/associates`),
      fetchJson<{ items: Goal[] }>(`/api/pro/businesses/${businessId}/goals?year=${currentYear}`),
      fetchJson<{ items: FinanceEntry[] }>(`/api/pro/businesses/${businessId}/finances?type=EXPENSE&year=${currentYear}`),
    ]).then(([assocRes, goalsRes, finRes]) => {
      if (cancelled) return;
      if (assocRes.ok && assocRes.data) setAssociates(assocRes.data.items);
      if (goalsRes.ok && goalsRes.data) setGoals(goalsRes.data.items);
      if (finRes.ok && finRes.data) setFinanceEntries(finRes.data.items);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [businessId, fetchKey, currentYear]);

  const reload = useCallback(() => { setFetchKey((k) => k + 1); revalidate('pro:finances'); }, []);

  // Compute paid salaries and dividends per associate from finance entries
  function getPaidCents(associateId: string, kind: 'salary' | 'dividend'): number {
    const prefix = kind === 'salary' ? `SALAIRE:${associateId}` : `DIVIDENDE:${associateId}`;
    return financeEntries
      .filter((e) => e.category === prefix)
      .reduce((sum, e) => sum + Math.abs(e.amountCents), 0);
  }

  async function handleVersement() {
    if (!versementForm) return;
    const cents = parseEuroToCents(versementForm.amount);
    if (!cents || cents <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    setVersementSaving(true);
    const category = versementForm.kind === 'salary'
      ? `SALAIRE:${versementForm.associateId}`
      : `DIVIDENDE:${versementForm.associateId}`;
    const res = await fetchJson(`/api/pro/businesses/${businessId}/finances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'EXPENSE',
        amountCents: cents,
        category,
        date: versementForm.date || new Date().toISOString().slice(0, 10),
        note: versementForm.kind === 'salary' ? 'Versement salaire dirigeant' : 'Distribution dividendes',
      }),
    });
    setVersementSaving(false);
    if (res.ok) {
      toast.success(versementForm.kind === 'salary' ? 'Versement salaire enregistre.' : 'Distribution enregistree.');
      setVersementForm(null);
      reload();
    } else {
      toast.error(res.error ?? 'Erreur.');
    }
  }

  // Debounced simulation
  useEffect(() => {
    const salary = Number(simSalary) || 0;
    const dividends = Number(simDividends) || 0;

    clearTimeout(simTimer.current);
    simTimer.current = setTimeout(async () => {
      if (salary <= 0 && dividends <= 0) {
        setSimResult(null);
        return;
      }
      setSimLoading(true);
      const res = await fetchJson<{ result: SimResult }>(`/api/pro/businesses/${businessId}/associates/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossSalaryYearlyCents: Math.round(salary * 100),
          dividendsCents: Math.round(dividends * 100),
        }),
      });
      setSimLoading(false);
      if (res.ok && res.data) setSimResult(res.data.result);
    }, 300);

    return () => clearTimeout(simTimer.current);
  }, [simSalary, simDividends, businessId]);

  async function runOptimize() {
    const budget = Number(optBudget);
    if (budget <= 0) return;
    setOptLoading(true);
    const res = await fetchJson<{ result: SimResult; optimal: OptimalResult }>(`/api/pro/businesses/${businessId}/associates/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grossSalaryYearlyCents: 0,
        dividendsCents: 0,
        totalBudgetCents: Math.round(budget * 100),
      }),
    });
    setOptLoading(false);
    if (res.ok && res.data?.optimal) setOptResult(res.data.optimal);
  }

  async function deleteAssociate(id: string) {
    const res = await fetchJson(`/api/pro/businesses/${businessId}/associates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Associe supprime.');
      reload();
    } else {
      toast.error(res.error ?? 'Erreur.');
    }
  }

  async function deleteGoal(id: string) {
    const res = await fetchJson(`/api/pro/businesses/${businessId}/goals/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Objectif supprime.');
      reload();
    } else {
      toast.error(res.error ?? 'Erreur.');
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-secondary)]">Chargement...</p>;

  return (
    <div className="space-y-4">
      {/* Section 1: Associates list */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[var(--text-secondary)]" />
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              Associes & Dirigeants
            </p>
          </div>
          <Button size="sm" onClick={() => { setEditAssociate(null); setShowAssociateModal(true); }} className="gap-1">
            <Plus size={14} /> Ajouter
          </Button>
        </div>

        {associates.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun associe renseigne.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]/40 text-left text-xs text-[var(--text-secondary)]">
                  <th className="pb-2 pr-3">Nom</th>
                  <th className="pb-2 pr-3">Role</th>
                  <th className="pb-2 pr-3 text-right">Parts</th>
                  <th className="pb-2 pr-3 text-right">Salaire brut/an</th>
                  <th className="pb-2 pr-3 text-right">Dividendes</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {associates.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)]/20 last:border-0">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => { setEditAssociate(a); setShowAssociateModal(true); }}
                        className="font-medium text-[var(--text-primary)] hover:underline text-left"
                      >
                        {a.name}
                        {a.isLeader && <span className="ml-1.5 rounded-full bg-[var(--shell-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--shell-accent)]">Dirigeant</span>}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)]">{ROLE_LABELS[a.role] ?? a.role}</td>
                    <td className="py-2 pr-3 text-right">{a.sharePercent}%</td>
                    <td className="py-2 pr-3 text-right">{formatCents(a.grossSalaryYearlyCents)}</td>
                    <td className="py-2 pr-3 text-right">{formatCents(a.dividendsCents)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteAssociate(a.id)}
                        className="text-[var(--text-faint)] hover:text-[var(--danger)] transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* KPIs versé vs cible per associate */}
        {associates.length > 0 && (
          <div className="mt-4 space-y-3">
            {associates.map((a) => {
              const salaryPaid = getPaidCents(a.id, 'salary');
              const dividendPaid = getPaidCents(a.id, 'dividend');
              const salaryTarget = a.grossSalaryYearlyCents;
              const dividendTarget = a.dividendsCents;
              const salaryPct = salaryTarget > 0 ? Math.min(100, Math.round((salaryPaid / salaryTarget) * 100)) : 0;
              const dividendPct = dividendTarget > 0 ? Math.min(100, Math.round((dividendPaid / dividendTarget) * 100)) : 0;
              const isFormOpen = versementForm?.associateId === a.id;

              return (
                <div key={a.id} className="rounded-xl border border-[var(--border)]/40 p-3 space-y-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{a.name}</p>
                  {salaryTarget > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>Salaire verse {currentYear}</span>
                        <span>{formatCents(salaryPaid)} / {formatCents(salaryTarget)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--border)]">
                        <div className="h-full rounded-full bg-[var(--shell-accent)] transition-all" style={{ width: `${salaryPct}%` }} />
                      </div>
                    </div>
                  )}
                  {dividendTarget > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>Dividendes verses {currentYear}</span>
                        <span>{formatCents(dividendPaid)} / {formatCents(dividendTarget)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--border)]">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${dividendPct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => setVersementForm({ associateId: a.id, kind: 'salary', amount: '', date: new Date().toISOString().slice(0, 10) })}
                    >
                      <Banknote size={12} /> Versement salaire
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => setVersementForm({ associateId: a.id, kind: 'dividend', amount: '', date: new Date().toISOString().slice(0, 10) })}
                    >
                      <Banknote size={12} /> Distribution dividendes
                    </Button>
                  </div>
                  {isFormOpen && versementForm && (
                    <div className="mt-2 flex items-end gap-2 rounded-lg border border-[var(--border)]/40 bg-[var(--surface)] p-3">
                      <Input
                        label={versementForm.kind === 'salary' ? 'Montant salaire (EUR)' : 'Montant dividendes (EUR)'}
                        type="text"
                        inputMode="decimal"
                        value={versementForm.amount}
                        onChange={(e) => setVersementForm({ ...versementForm, amount: e.target.value })}
                        placeholder="Ex : 3000"
                      />
                      <Input
                        label="Date"
                        type="date"
                        value={versementForm.date}
                        onChange={(e) => setVersementForm({ ...versementForm, date: e.target.value })}
                      />
                      <Button size="sm" onClick={handleVersement} disabled={versementSaving}>
                        {versementSaving ? 'En cours...' : 'Valider'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setVersementForm(null)}>
                        Annuler
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Section 2: Cost simulation */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator size={16} className="text-[var(--text-secondary)]" />
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
            Simulation de cout dirigeant
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Salaire brut annuel (EUR)"
            type="number"
            min="0"
            step="100"
            value={simSalary}
            onChange={(e) => setSimSalary(e.target.value)}
            placeholder="ex: 40000"
          />
          <Input
            label="Dividendes annuels (EUR)"
            type="number"
            min="0"
            step="100"
            value={simDividends}
            onChange={(e) => setSimDividends(e.target.value)}
            placeholder="ex: 20000"
          />
        </div>

        {simLoading && <p className="mt-2 text-xs text-[var(--text-secondary)]">Calcul en cours...</p>}

        {simResult && !simLoading && (
          <div className="mt-4 space-y-3">
            {/* Waterfall */}
            <div className="space-y-1.5 text-sm">
              <WaterfallLine label="Salaire brut annuel" value={formatCents(simResult.grossSalaryCents)} />
              {simResult.chargesPatronalesCents > 0 && (
                <WaterfallLine label="Charges patronales" value={`-${formatCents(simResult.chargesPatronalesCents)}`} sub negative />
              )}
              {simResult.cotisationsTNSCents > 0 && (
                <WaterfallLine label="Cotisations TNS" value={`-${formatCents(simResult.cotisationsTNSCents)}`} sub negative />
              )}
              <WaterfallLine label="Net avant IR (salaire)" value={formatCents(simResult.netAvantIRCents)} bold />
              <div className="border-t border-[var(--border)]/40 pt-1" />
              <WaterfallLine label="Dividendes bruts" value={formatCents(simResult.dividendesBrutsCents)} />
              <WaterfallLine label="Fiscalite dividendes (PFU + TNS)" value={`-${formatCents(simResult.dividendesTaxCents)}`} sub negative />
              <WaterfallLine label="Dividendes nets" value={formatCents(simResult.dividendesNetsCents)} bold />
              <div className="border-t border-[var(--border)]/40 pt-1" />
              <WaterfallLine label="Cout total pour l'entreprise" value={formatCents(simResult.coutTotalDirigeantCents)} bold highlight="danger" />
              <WaterfallLine label="Revenu net total du dirigeant" value={formatCents(simResult.revenuNetTotalCents)} bold highlight="success" />
            </div>

            {/* Efficiency ratio */}
            {simResult.coutTotalDirigeantCents > 0 && (
              <div className="rounded-lg bg-[var(--surface)]/50 p-2 text-xs text-[var(--text-secondary)]">
                Ratio d&apos;efficacite : {Math.round((simResult.revenuNetTotalCents / simResult.coutTotalDirigeantCents) * 10000) / 100}% du cout total revient au dirigeant
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section 3: Optimization */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--text-secondary)]" />
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
            Optimisation salaire / dividendes
          </p>
        </div>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          Trouvez la repartition qui maximise le revenu net du dirigeant pour une enveloppe donnee.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Enveloppe totale disponible (EUR)"
              type="number"
              min="0"
              step="1000"
              value={optBudget}
              onChange={(e) => setOptBudget(e.target.value)}
              placeholder="ex: 60000"
            />
          </div>
          <Button onClick={runOptimize} disabled={optLoading || !Number(optBudget)} size="sm">
            {optLoading ? 'Calcul...' : 'Optimiser'}
          </Button>
        </div>

        {optResult && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Repartition optimale :</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Salaire brut</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCents(optResult.optimalSalaryCents)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Dividendes</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCents(optResult.optimalDividendsCents)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Net max</p>
                <p className="text-sm font-semibold text-emerald-600">{formatCents(optResult.netMaxCents)}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Section 4: Goals */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[var(--text-secondary)]" />
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              Objectifs financiers
            </p>
          </div>
          <Button size="sm" onClick={() => { setEditGoal(null); setShowGoalModal(true); }} className="gap-1">
            <Plus size={14} /> Ajouter
          </Button>
        </div>

        {goals.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun objectif defini pour cette annee.</p>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => (
              <GoalRow key={g.id} goal={g} onEdit={() => { setEditGoal(g); setShowGoalModal(true); }} onDelete={() => deleteGoal(g.id)} />
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <AssociateFormModal
        open={showAssociateModal}
        businessId={businessId}
        associate={editAssociate}
        onCloseAction={() => setShowAssociateModal(false)}
        onSaved={reload}
      />
      <GoalFormModal
        open={showGoalModal}
        businessId={businessId}
        goal={editGoal}
        onCloseAction={() => setShowGoalModal(false)}
        onSaved={reload}
      />
    </div>
  );
}

/* ═══ Sub-components ═══ */

function WaterfallLine({ label, value, sub, bold, negative, highlight }: {
  label: string;
  value: string;
  sub?: boolean;
  bold?: boolean;
  negative?: boolean;
  highlight?: 'success' | 'danger';
}) {
  const color = highlight === 'success'
    ? 'text-emerald-600'
    : highlight === 'danger'
      ? 'text-[var(--danger)]'
      : negative
        ? 'text-red-400'
        : '';
  return (
    <div className={`flex items-center justify-between ${sub ? 'pl-3' : ''}`}>
      <span className={`${bold ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} ${sub ? 'text-xs' : 'text-sm'}`}>
        {label}
      </span>
      <span className={`${bold ? 'font-semibold' : 'font-medium'} ${color} ${sub ? 'text-xs' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

const METRIC_LABELS: Record<string, string> = {
  CA_HT: 'CA HT',
  RESULTAT_NET: 'Resultat net',
  REVENU_NET_DIRIGEANT: 'Revenu net dirigeant',
  MARGE_BRUTE: 'Marge brute',
};

function GoalRow({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--border)]/40 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <button type="button" onClick={onEdit} className="text-sm font-medium text-[var(--text-primary)] hover:underline text-left">
          {goal.name}
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {METRIC_LABELS[goal.metric] ?? goal.metric}
          </span>
          <button type="button" onClick={onDelete} className="text-[var(--text-faint)] hover:text-[var(--danger)] transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-1">
        Objectif : {formatCents(goal.targetCents)} · {goal.year}
      </p>
    </div>
  );
}
