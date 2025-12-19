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
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tickMargin={8} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="income" stroke="#10b981" name="Revenus" strokeWidth={2} />
          <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Dépenses" strokeWidth={2} />
          <Line type="monotone" dataKey="net" stroke="#3b82f6" name="Net" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
