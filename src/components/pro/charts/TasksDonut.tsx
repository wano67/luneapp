'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS_DEFAULT = ['var(--warning)', 'var(--accent)', 'var(--success)'];
const COLORS_ACCENT = ['var(--accent-light)', 'var(--shell-accent-dark)', 'white'];

export type TasksDonutProps = {
  data: { name: string; value: number }[];
  variant?: 'default' | 'accent';
};

export default function TasksDonut({ data, variant = 'default' }: TasksDonutProps) {
  const filtered = (data ?? []).filter((d) => d.value > 0);
  const isAccent = variant === 'accent';
  const colors = isAccent ? COLORS_ACCENT : COLORS_DEFAULT;
  const total = filtered.reduce((sum, d) => sum + d.value, 0);
  const doneCount = data.find((d) => d.name.toLowerCase().includes('termin'))?.value ?? 0;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (filtered.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center sm:h-48">
        <p className="text-sm" style={{ color: isAccent ? 'rgba(255,255,255,0.6)' : 'var(--text-faint)' }}>
          Aucune tache
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-48 w-48 sm:h-56 sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              dataKey="value"
              data={filtered}
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
            >
              {filtered.map((entry, index) => (
                <Cell key={`cell-${entry.name}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: isAccent ? 'var(--shell-accent-dark)' : 'var(--surface)',
                border: isAccent ? '0' : '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                color: isAccent ? 'white' : undefined,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-extrabold"
            style={{
              fontSize: 38,
              color: isAccent ? 'white' : 'var(--text)',
            }}
          >
            {pct}%
          </span>
          <span
            className="text-xs"
            style={{ color: isAccent ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}
          >
            Terminees
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            <span
              className="text-xs"
              style={{ color: isAccent ? 'white' : 'var(--text-faint)' }}
            >
              {d.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
