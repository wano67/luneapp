import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

type Prefs = {
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
  defaultCurrency: string;
  defaultTransactionType: string;
  defaultBudgetPeriod: string;
  defaultSubscriptionFrequency: string;
  dashboardPeriodDays: number;
  itemsPerPage: number;
};

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'] as const;
const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;
const BUDGET_PERIODS = ['MONTHLY', 'YEARLY'] as const;
const SUB_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
const DASHBOARD_PERIODS = [30, 90, 365] as const;
const PAGE_SIZES = [25, 50, 100] as const;

function normLanguage(v: unknown): 'fr' | 'en' {
  return v === 'en' ? 'en' : 'fr';
}

function normTheme(v: unknown): Prefs['theme'] {
  return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
}

function normEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function normInt<T extends number>(v: unknown, allowed: readonly T[], fallback: T): T {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  return allowed.includes(n as T) ? (n as T) : fallback;
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: {
      language: true, theme: true,
      defaultCurrency: true, defaultTransactionType: true,
      defaultBudgetPeriod: true, defaultSubscriptionFrequency: true,
      dashboardPeriodDays: true, itemsPerPage: true,
    },
  });

  const prefs: Prefs = {
    language: normLanguage(user?.language),
    theme: normTheme(user?.theme),
    defaultCurrency: normEnum(user?.defaultCurrency, CURRENCIES, 'EUR'),
    defaultTransactionType: normEnum(user?.defaultTransactionType, TRANSACTION_TYPES, 'EXPENSE'),
    defaultBudgetPeriod: normEnum(user?.defaultBudgetPeriod, BUDGET_PERIODS, 'MONTHLY'),
    defaultSubscriptionFrequency: normEnum(user?.defaultSubscriptionFrequency, SUB_FREQUENCIES, 'MONTHLY'),
    dashboardPeriodDays: normInt(user?.dashboardPeriodDays, DASHBOARD_PERIODS, 30),
    itemsPerPage: normInt(user?.itemsPerPage, PAGE_SIZES, 50),
  };

  return withRequestId(jsonNoStore(prefs), requestId);
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { userId } = await requireAuthAsync(req).catch(() => ({ userId: null }));
  if (!userId) return withRequestId(unauthorized(), requestId);

  const limited = rateLimit(req, {
    key: `account:prefs:${userId}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body: Partial<Prefs> = await req.json().catch(() => ({}));
  const language = normLanguage(body.language);
  const theme = normTheme(body.theme);
  const defaultCurrency = normEnum(body.defaultCurrency, CURRENCIES, 'EUR');
  const defaultTransactionType = normEnum(body.defaultTransactionType, TRANSACTION_TYPES, 'EXPENSE');
  const defaultBudgetPeriod = normEnum(body.defaultBudgetPeriod, BUDGET_PERIODS, 'MONTHLY');
  const defaultSubscriptionFrequency = normEnum(body.defaultSubscriptionFrequency, SUB_FREQUENCIES, 'MONTHLY');
  const dashboardPeriodDays = normInt(body.dashboardPeriodDays, DASHBOARD_PERIODS, 30);
  const itemsPerPage = normInt(body.itemsPerPage, PAGE_SIZES, 50);

  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: {
      language, theme,
      defaultCurrency, defaultTransactionType,
      defaultBudgetPeriod, defaultSubscriptionFrequency,
      dashboardPeriodDays, itemsPerPage,
    },
  });

  const prefs: Prefs = {
    language, theme,
    defaultCurrency, defaultTransactionType,
    defaultBudgetPeriod, defaultSubscriptionFrequency,
    dashboardPeriodDays, itemsPerPage,
  };
  const res = withRequestId(jsonNoStore(prefs), requestId);

  // Keep cookie for theme so SSR can apply it (prevents FOUC)
  res.cookies.set('pref_theme', theme, { sameSite: 'lax', path: '/' });

  return res;
}
