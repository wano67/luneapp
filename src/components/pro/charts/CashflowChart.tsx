'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type MonthlyPoint = {
  month: string;
  incomeCents: string | number;
  expenseCents: string | number;
};

function toNumber(value: string | number) {
  if (typeof value === 'number') return value / 100;
  const num = Number(value);
  return Number.isFinite(num) ? num / 100 : 0;
}

export type CashflowChartProps = {
  series: MonthlyPoint[];
};

function formatEur(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k€`;
  return `${value.toFixed(0)}€`;
}

export default function CashflowChart({ series }: CashflowChartProps) {
  const data = (series ?? []).map((m) => {
    const income = toNumber(m.incomeCents);
    const expense = toNumber(m.expenseCents);
    return {
      month: m.month,
      income,
      expense,
      net: income - expense,
    };
  });

  return (
    <div className="h-48 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tickMargin={6}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatEur}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickCount={5}
          />
          <Tooltip formatter={(v) => formatEur(Number(v ?? 0))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="income" stroke="var(--success)" name="Revenus" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="expense" stroke="var(--danger)" name="Dépenses" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="net" stroke="var(--accent)" name="Net" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
