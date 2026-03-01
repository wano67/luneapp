'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['var(--warning)', 'var(--accent)', 'var(--success)'];

export type TasksDonutProps = {
  data: { name: string; value: number }[];
};

export default function TasksDonut({ data }: TasksDonutProps) {
  const filtered = (data ?? []).filter((d) => d.value > 0);

  if (filtered.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center sm:h-48">
        <p className="text-sm text-[var(--text-faint)]">Aucune tâche</p>
      </div>
    );
  }

  return (
    <div className="h-40 sm:h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            dataKey="value"
            data={filtered}
            innerRadius="45%"
            outerRadius="70%"
            paddingAngle={2}
          >
            {filtered.map((entry, index) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
