'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export type PipelineBarProps = {
  data: { name: string; value: number }[];
};

export default function PipelineBar({ data }: PipelineBarProps) {
  const dataset = data ?? [];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dataset}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tickMargin={8} tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" name="Prospects" fill="var(--chart-accent)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
