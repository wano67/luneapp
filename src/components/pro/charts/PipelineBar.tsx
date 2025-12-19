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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tickMargin={8} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" name="Prospects" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
