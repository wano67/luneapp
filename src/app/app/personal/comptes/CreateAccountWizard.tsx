'use client';

import { useMemo, useState } from 'react';
import { Banknote, PiggyBank, TrendingUp, HandCoins, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchSelect } from '@/components/ui/search-select';
import { BANKS, BANK_MAP, BANK_TYPE_LABEL, type BankType } from '@/config/banks';
import {
  PRODUCT_MAP,
  PRODUCT_CATEGORY_LABEL,
  getProductsByCategory,
  type ProductCategory,
} from '@/config/bankingProducts';
import { loanMonthlyPaymentCents, loanTotalCostCents, formatRateBps } from '@/lib/finance';
import { fmtKpi } from '@/lib/format';

/* ═══ Types ═══ */

export type WizardResult = {
  name: string;
  type: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH' | 'LOAN';
  currency: string;
  institution: string | null;
  iban: string | null;
  initialCents: string;
  bankCode: string | null;
  productCode: string | null;
  interestRateBps: number | null;
  loanPrincipalCents: string | null;
  loanDurationMonths: number | null;
  loanStartDate: string | null;
};

type Props = {
  onSubmit: (data: WizardResult) => void;
  onCancel: () => void;
  submitting: boolean;
  error?: string | null;
};

const CATEGORIES: { key: ProductCategory; label: string; icon: typeof Banknote; desc: string }[] = [
  { key: 'CHECKING', label: 'Espèces', icon: Banknote, desc: 'Comptes courants, cash' },
  { key: 'SAVINGS', label: 'Épargne', icon: PiggyBank, desc: 'Livrets, PEL, CEL...' },
  { key: 'INVESTMENT', label: 'Investissement', icon: TrendingUp, desc: 'PEA, CTO, assurance-vie...' },
  { key: 'LOAN', label: 'Prêt', icon: HandCoins, desc: 'Immobilier, conso, auto...' },
];

/* ═══ Wizard ═══ */

export default function CreateAccountWizard({ onSubmit, onCancel, submitting, error }: Props) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [productCode, setProductCode] = useState('');

  // Step 4 form fields
  const [accountName, setAccountName] = useState('');
  const [initialEuros, setInitialEuros] = useState('');
  const [iban, setIban] = useState('');
  const [ratePct, setRatePct] = useState('');
  const [loanAmountEuros, setLoanAmountEuros] = useState('');
  const [loanDurationMonths, setLoanDurationMonths] = useState('');
  const [loanStartDate, setLoanStartDate] = useState('');

  const selectedBank = BANK_MAP.get(bankCode) ?? null;
  const selectedProduct = PRODUCT_MAP.get(productCode) ?? null;

  const bankItems = useMemo(() => {
    const byType: Record<BankType, typeof BANKS> = { TRADITIONAL: [], ONLINE: [], NEOBANK: [] };
    for (const b of BANKS) byType[b.type].push(b);
    const items: { code: string; label: string; meta?: string }[] = [];
    for (const t of ['TRADITIONAL', 'ONLINE', 'NEOBANK'] as BankType[]) {
      for (const b of byType[t]) {
        items.push({ code: b.code, label: b.name, meta: BANK_TYPE_LABEL[t] });
      }
    }
    items.push({ code: 'OTHER', label: 'Autre banque' });
    return items;
  }, []);

  const productItems = useMemo(() => {
    if (!category) return [];
    return getProductsByCategory(category);
  }, [category]);

  // Auto-fill rate when product is selected
  function selectProduct(code: string) {
    setProductCode(code);
    const product = PRODUCT_MAP.get(code);
    if (product?.regulatedRateBps) {
      setRatePct((product.regulatedRateBps / 100).toFixed(2));
    }
    // Auto-fill name
    const bankName = selectedBank?.shortName ?? '';
    const productName = product?.name ?? '';
    if (productName && bankName) {
      setAccountName(`${productName} — ${bankName}`);
    } else if (productName) {
      setAccountName(productName);
    }
    setStep(4);
  }

  function selectBank(code: string) {
    setBankCode(code);
    setStep(3);
  }

  function selectCategory(cat: ProductCategory) {
    setCategory(cat);
    setStep(2);
  }

  // Loan calculation preview
  const loanPreview = useMemo(() => {
    if (category !== 'LOAN') return null;
    const amountCents = eurosToCents(loanAmountEuros);
    const months = parseInt(loanDurationMonths, 10);
    const rateBps = Math.round(parseFloat(ratePct || '0') * 100);
    if (!amountCents || months <= 0 || rateBps <= 0) return null;
    const monthly = loanMonthlyPaymentCents(amountCents, rateBps, months);
    const totalCost = loanTotalCostCents(amountCents, rateBps, months);
    const totalInterest = totalCost - amountCents;
    return { monthly, totalCost, totalInterest };
  }, [category, loanAmountEuros, loanDurationMonths, ratePct]);

  function handleSubmit() {
    const product = PRODUCT_MAP.get(productCode);
    const isLoan = category === 'LOAN';
    const rateBps = ratePct ? Math.round(parseFloat(ratePct) * 100) : null;

    const result: WizardResult = {
      name: accountName.trim() || (product?.name ?? 'Compte'),
      type: product?.accountType ?? (isLoan ? 'LOAN' : 'CURRENT'),
      currency: 'EUR',
      institution: selectedBank?.name ?? null,
      iban: iban.trim() || null,
      initialCents: isLoan ? '0' : eurosToCentsStr(initialEuros),
      bankCode: bankCode === 'OTHER' ? null : bankCode || null,
      productCode: productCode || null,
      interestRateBps: rateBps,
      loanPrincipalCents: isLoan ? eurosToCentsStr(loanAmountEuros) : null,
      loanDurationMonths: isLoan ? parseInt(loanDurationMonths, 10) || null : null,
      loanStartDate: isLoan && loanStartDate ? loanStartDate : null,
    };

    onSubmit(result);
  }

  function goBack() {
    if (step > 1) setStep(step - 1);
    else onCancel();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={goBack} className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors">
          <ChevronLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <span className="text-sm text-[var(--text-faint)]">
          Étape {step}/4 — {step === 1 ? 'Catégorie' : step === 2 ? 'Banque' : step === 3 ? 'Produit' : 'Détails'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(step / 4) * 100}%`, background: 'var(--shell-accent)' }}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* Step 1: Category */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => selectCategory(c.key)}
                className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] p-4 text-center transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--shell-accent)]"
              >
                <Icon size={28} style={{ color: 'var(--shell-accent)' }} />
                <span className="text-sm font-semibold text-[var(--text)]">{c.label}</span>
                <span className="text-xs text-[var(--text-faint)]">{c.desc}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 2: Bank */}
      {step === 2 && (
        <SearchSelect
          label="Choisir une banque"
          placeholder="Rechercher une banque..."
          items={bankItems}
          value={bankCode}
          onChange={selectBank}
        />
      )}

      {/* Step 3: Product */}
      {step === 3 && category && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-[var(--text)]">
            {PRODUCT_CATEGORY_LABEL[category]} — {selectedBank?.shortName ?? 'Autre'}
          </p>
          <div className="flex flex-col gap-2">
            {productItems.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => selectProduct(p.code)}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--shell-accent)]"
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-[var(--text)]">{p.name}</span>
                  {p.description ? (
                    <p className="text-xs text-[var(--text-faint)] mt-0.5 line-clamp-1">{p.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {p.regulatedRateBps ? (
                    <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-[var(--success-bg)] text-[var(--success)]">
                      {formatRateBps(p.regulatedRateBps)}
                    </span>
                  ) : null}
                  {p.maxDepositCents ? (
                    <span className="text-xs text-[var(--text-faint)]">
                      max {fmtKpi(String(p.maxDepositCents))}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
            {/* Custom product */}
            <button
              type="button"
              onClick={() => {
                setProductCode('');
                setStep(4);
              }}
              className="flex items-center justify-between rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span className="text-sm text-[var(--text-faint)]">Autre / Personnalisé</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Details */}
      {step === 4 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Nom du compte"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder={selectedProduct?.name ?? 'Mon compte'}
            data-autofocus="true"
          />

          {category !== 'LOAN' ? (
            <>
              <Input
                label="Solde initial (€)"
                value={initialEuros}
                onChange={(e) => setInitialEuros(e.target.value)}
                placeholder="0.00"
              />
              <Input
                label="IBAN (optionnel)"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 ..."
              />
            </>
          ) : (
            <>
              <Input
                label="Montant emprunté (€)"
                value={loanAmountEuros}
                onChange={(e) => setLoanAmountEuros(e.target.value)}
                placeholder="200000"
              />
              <Input
                label="Durée (mois)"
                value={loanDurationMonths}
                onChange={(e) => setLoanDurationMonths(e.target.value)}
                placeholder="240"
              />
              <Input
                label="Date de début"
                value={loanStartDate}
                onChange={(e) => setLoanStartDate(e.target.value)}
                placeholder="2026-01-15"
                type="date"
              />
            </>
          )}

          {/* Interest rate — shown for SAVINGS, INVESTMENT, LOAN */}
          {category !== 'CHECKING' ? (
            <Input
              label="Taux d'intérêt annuel (%)"
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              placeholder={selectedProduct?.regulatedRateBps ? formatRateBps(selectedProduct.regulatedRateBps) : '1.50'}
              helper={selectedProduct?.regulatedRateBps ? `Taux réglementé : ${formatRateBps(selectedProduct.regulatedRateBps)}` : undefined}
            />
          ) : null}

          {/* Loan preview */}
          {loanPreview ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-faint)]">Mensualité</span>
                <span className="text-sm font-bold text-[var(--text)]">{fmtKpi(loanPreview.monthly.toString())}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-faint)]">Coût total du crédit</span>
                <span className="text-sm font-semibold text-[var(--text)]">{fmtKpi(loanPreview.totalCost.toString())}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-faint)]">Total des intérêts</span>
                <span className="text-sm font-semibold text-[var(--danger)]">{fmtKpi(loanPreview.totalInterest.toString())}</span>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onCancel} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Création…' : 'Créer le compte'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ═══ Helpers ═══ */

function eurosToCents(input: string): bigint | null {
  const cleaned = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return BigInt(Math.round(num * 100));
}

function eurosToCentsStr(input: string): string {
  const cents = eurosToCents(input);
  return cents != null ? cents.toString() : '0';
}
