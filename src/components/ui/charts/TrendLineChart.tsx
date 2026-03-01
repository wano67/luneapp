'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TrendLineChartPoint = {
  label: string;
  value: number;
};

export type TrendLineChartProps = {
  data: TrendLineChartPoint[];
  color?: string;
  height?: number;
};

function formatValue(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

export function TrendLineChart({
  data,
  color = 'var(--accent)',
  height = 280,
}: TrendLineChartProps) {
  const dataset = data ?? [];

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dataset} margin={{ top: 8, right: 12, bottom: 6, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            tickMargin={6}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            tickFormatter={formatValue}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip
            formatter={(value) => formatValue(Number(value ?? 0))}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
