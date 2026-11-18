import { dateKey, localDate, totals, weekKey, type Slice } from "./domain";

/** Group the chosen workplace's slices once by their payroll week and display day. */
export function dashboardWeek(slices: Slice[], week: string, jobId: string) {
  const start = localDate(week);
  const dates = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    return dateKey(day);
  });
  const selected = slices.filter(
    (slice) =>
      slice.entry.jobId === jobId &&
      weekKey(localDate(slice.weekDate)) === week,
  );
  return {
    total: totals(selected),
    days: dates.map((date) => {
      const parts = selected.filter((part) => {
        const displayDate = dates.includes(part.date)
          ? part.date
          : part.weekDate;
        return displayDate === date;
      });
      return { date, parts, total: totals(parts) };
    }),
  };
}
