import { dateKey, localDate } from "./domain";
export function calendarDays(month: string): (string | null)[] {
  const first = localDate(`${month}-01`),
    offset = (first.getDay() + 6) % 7;
  const count = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) =>
    i < offset || i >= offset + count
      ? null
      : `${month}-${String(i - offset + 1).padStart(2, "0")}`,
  );
}
export function moveMonth(month: string, offset: number) {
  const d = localDate(`${month}-01`);
  d.setMonth(d.getMonth() + offset);
  return dateKey(d).slice(0, 7);
}
