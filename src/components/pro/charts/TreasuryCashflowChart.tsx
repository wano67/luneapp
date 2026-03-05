'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type SeriesPoint = {
  label?: string;
  month?: string;
  incomeCents: string | number;
  expenseCents: string | number;
};

export type TreasuryCashflowChartProps = {
  series: SeriesPoint[];
  granularity?: 'daily' | 'weekly' | 'monthly';
  openingBalanceCents?: string | number;
  height?: string;
  variant?: 'default' | 'accent';
};

function toEuro(value: string | number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num / 100 : 0;
}

function formatEur(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k\u202F\u20AC`;
  return `${value.toFixed(0)}\u202F\u20AC`;
}

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
  '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Aoû',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

/** Format a label for the X axis based on granularity. */
function formatLabel(raw: string, granularity: 'daily' | 'weekly' | 'monthly'): string {
  if (granularity === 'daily') {
    // "YYYY-MM-DD" → "DD/MM"
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return raw;
  }
  if (granularity === 'weekly') {
    // "W-YYYY-MM-DD" → "DD/MM"
    const datePart = raw.replace(/^W-/, '');
    const parts = datePart.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return raw;
  }
  // monthly: "YYYY-MM" → abbreviated month name
  const parts = raw.split('-');
  return MONTH_SHORT[parts[1]] ?? raw;
}

export default function TreasuryCashflowChart({
  series,
  granularity = 'monthly',
  openingBalanceCents,
  height = 'h-56 sm:h-72',
  variant = 'default',
}: TreasuryCashflowChartProps) {
  const isAccent = variant === 'accent';

  const data = useMemo(() => {
    const opening = toEuro(openingBalanceCents ?? 0);
    return (series ?? []).reduce<{ items: { label: string; income: number; expense: number; treasury: number }[]; running: number }>(
      (acc, m) => {
        const income = toEuro(m.incomeCents);
        const expense = toEuro(m.expenseCents);
        const running = acc.running + income - expense;
        const rawLabel = m.label ?? m.month ?? '';
        acc.items.push({
          label: formatLabel(rawLabel, granularity),
          income,
          expense,
          treasury: Math.round(running * 100) / 100,
        });
        return { items: acc.items, running };
      },
      { items: [], running: opening }
    ).items;
  }, [series, openingBalanceCents, granularity]);

  const tickFill = isAccent ? 'white' : 'var(--text-faint)';
  const gridStroke = isAccent ? 'rgba(255,255,255,0.4)' : 'var(--border)';

  // Show fewer ticks for dense series (daily/weekly)
  const tickInterval = data.length > 30 ? Math.ceil(data.length / 15) - 1 : 0;

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="label"
            tickMargin={6}
            tick={{ fontSize: 11, fill: tickFill }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            yAxisId="bars"
            tickFormatter={formatEur}
            tick={{ fontSize: 11, fill: tickFill }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickCount={5}
          />
          <YAxis
            yAxisId="line"
            orientation="right"
            tickFormatter={formatEur}
            tick={{ fontSize: 11, fill: isAccent ? 'white' : 'var(--shell-accent)' }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickCount={5}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [formatEur(Number(v) || 0), String(name ?? '')]}
            contentStyle={{
              background: isAccent ? 'var(--shell-accent-dark)' : 'var(--surface)',
              border: isAccent ? '0' : '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: isAccent ? 'white' : undefined,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: isAccent ? 'white' : undefined }} />
          <Bar
            yAxisId="bars"
            dataKey="income"
            name="Revenus"
            fill={isAccent ? 'rgba(255,255,255,0.55)' : 'var(--success)'}
            radius={[3, 3, 0, 0]}
            barSize={granularity === 'daily' ? 6 : granularity === 'weekly' ? 10 : 14}
          />
          <Bar
            yAxisId="bars"
            dataKey="expense"
            name="Depenses"
            fill={isAccent ? 'var(--shell-accent-dark)' : 'var(--danger)'}
            radius={[3, 3, 0, 0]}
            barSize={granularity === 'daily' ? 6 : granularity === 'weekly' ? 10 : 14}
          />
          <Line
            yAxisId="line"
            type="monotone"
            dataKey="treasury"
            name="Tresorerie"
            stroke={isAccent ? 'white' : 'var(--shell-accent)'}
            strokeWidth={2.5}
            dot={granularity === 'daily' ? false : { r: 3, fill: isAccent ? 'white' : 'var(--shell-accent)' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
