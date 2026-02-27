export function clampDayOfMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
}

export function buildMonthlyDate(base: Date, year: number, month: number, day: number) {
  const safeDay = clampDayOfMonth(year, month, day);
  return new Date(
    year,
    month,
    safeDay,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

export function addMonths(base: Date, months: number, dayOfMonth: number) {
  const year = base.getFullYear();
  const month = base.getMonth() + months;
  return buildMonthlyDate(base, year, month, dayOfMonth);
}

export function enumerateMonthlyDates(params: {
  startDate: Date;
  endDate?: Date | null;
  dayOfMonth: number;
  from: Date;
  to: Date;
}) {
  const { startDate, endDate, dayOfMonth, from, to } = params;
  const fromMonth = new Date(from.getFullYear(), from.getMonth(), 1);
  const toMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  if (toMonth < fromMonth) return [];
  const startIndex = fromMonth.getFullYear() * 12 + fromMonth.getMonth();
  const endIndex = toMonth.getFullYear() * 12 + toMonth.getMonth();
  const dates: Date[] = [];
  for (let idx = startIndex; idx <= endIndex; idx += 1) {
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    const candidate = buildMonthlyDate(startDate, year, month, dayOfMonth);
    if (candidate < startDate) continue;
    if (endDate && candidate > endDate) continue;
    if (candidate < startMonth) continue;
    dates.push(candidate);
  }
  return dates;
}
