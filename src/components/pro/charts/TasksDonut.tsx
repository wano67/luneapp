'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981'];

export type TasksDonutProps = {
  data: { name: string; value: number }[];
};

export default function TasksDonut({ data }: TasksDonutProps) {
  const filtered = (data ?? []).filter((d) => d.value > 0);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" data={filtered} label>
            {filtered.map((entry, index) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
