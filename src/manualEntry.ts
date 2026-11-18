import { dateKey, localDate, parseLocal, type Shift } from "./domain";

// Move calendar days in local time, including over daylight-saving changes.
export function manualDates(day: string, shift: Shift) {
  parseLocal(day, "12:00");
  const end = localDate(day);
  if (shift.endTime < shift.startTime) end.setDate(end.getDate() + 1);
  return { startDate: day, endDate: dateKey(end) };
}

export function previousLocalDay(now: number, days = 1) {
  const day = new Date(now);
  day.setDate(day.getDate() - days);
  return dateKey(day);
}
export function moveManualDay(day: string, offset: number) {
  parseLocal(day, "12:00");
  const value = localDate(day);
  value.setDate(value.getDate() + offset);
  return dateKey(value);
}
