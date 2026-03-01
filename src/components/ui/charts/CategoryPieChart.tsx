'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type CategoryPieChartPoint = {
  name: string;
  value: number;
  color?: string;
};

export type CategoryPieChartProps = {
  data: CategoryPieChartPoint[];
  height?: number;
};

const DEFAULT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

function formatValue(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

export function CategoryPieChart({ data, height = 300 }: CategoryPieChartProps) {
  const dataset = (data ?? []).filter((point) => point.value > 0);

  if (dataset.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height }}>
        Aucune donnée disponible.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dataset}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {dataset.map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatValue(Number(value ?? 0))}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--text-faint)' }}
            iconType="circle"
            formatter={(value: string) => value}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
