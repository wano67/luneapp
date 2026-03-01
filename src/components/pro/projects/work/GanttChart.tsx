"use client";

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import type { TaskItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

type GanttChartProps = {
  tasks: TaskItem[];
  onTaskClick: (taskId: string) => void;
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'var(--text-secondary)',
  IN_PROGRESS: '#f59e0b',
  DONE: '#10b981',
};

const MS_PER_DAY = 86_400_000;

function formatDayLabel(dayOffset: number, minDate: number): string {
  const d = new Date(minDate + dayOffset * MS_PER_DAY);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}

type GanttEntry = {
  name: string;
  taskId: string;
  offset: number;
  duration: number;
  status: string;
};

function GanttTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: GanttEntry }> }) {
  if (!active || !payload?.[1]) return null;
  const entry = payload[1].payload;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.name}</p>
      <p className="text-xs text-[var(--text-secondary)]">
        {entry.duration} jour{entry.duration > 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function GanttChart({ tasks, onTaskClick }: GanttChartProps) {
  const { chartData, maxDays, minDate } = useMemo(() => {
    const eligible = tasks.filter(
      (t) => t.startDate && t.dueDate && !t.parentTaskId
    );

    if (eligible.length === 0) {
      return { chartData: [] as GanttEntry[], maxDays: 0, minDate: 0 };
    }

    const starts = eligible.map((t) => new Date(t.startDate!).getTime());
    const ends = eligible.map((t) => new Date(t.dueDate!).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    const totalDays = Math.ceil((max - min) / MS_PER_DAY) + 1;

    const data: GanttEntry[] = eligible.map((t) => {
      const start = new Date(t.startDate!).getTime();
      const end = new Date(t.dueDate!).getTime();
      return {
        name: t.title.length > 28 ? t.title.slice(0, 28) + '…' : t.title,
        taskId: t.id,
        offset: Math.max(0, (start - min) / MS_PER_DAY),
        duration: Math.max(1, Math.ceil((end - start) / MS_PER_DAY)),
        status: t.status,
      };
    });

    return { chartData: data, maxDays: totalDays, minDate: min };
  }, [tasks]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        Ajoutez des dates de début et fin à vos tâches pour voir le diagramme de Gantt.
      </div>
    );
  }

  const chartHeight = Math.max(200, chartData.length * 40 + 60);

  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/80 p-4">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            domain={[0, maxDays]}
            tickFormatter={(v: number) => formatDayLabel(v, minDate)}
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 12, fill: 'var(--text-primary)' }}
          />
          <Tooltip content={<GanttTooltipContent />} cursor={false} />
          {/* Invisible offset bar */}
          <Bar dataKey="offset" stackId="gantt" fill="transparent" isAnimationActive={false} />
          {/* Visible duration bar */}
          <Bar
            dataKey="duration"
            stackId="gantt"
            radius={[4, 4, 4, 4]}
            isAnimationActive={false}
            onClick={(_data: unknown, index: number) => {
              const entry = chartData[index];
              if (entry?.taskId) onTaskClick(entry.taskId);
            }}
            cursor="pointer"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.taskId}
                fill={STATUS_COLORS[entry.status] ?? STATUS_COLORS.TODO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
