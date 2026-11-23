/**
 * Make hour fields forgiving: "17.45", "17,45" or "17 45" become "17:45" while
 * typing, and on leaving the field "1745" → "17:45", "945" → "09:45",
 * "9:45" → "09:45" and "17" → "17:00".
 */
export function typeTimeInput(value: string): string {
  return value.replace(/[.,;\s]/g, ":").replace(/[^\d:]/g, "");
}
export function finishTimeInput(value: string): string {
  const v = typeTimeInput(value.trim());
  let match = /^(\d{1,3}):(\d{2})$/.exec(v);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  match = /^(\d{1,3}):(\d)$/.exec(v);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}0`;
  match = /^(\d{1,2})(\d{2})$/.exec(v);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  match = /^(\d{1,3}):?$/.exec(v);
  if (match) return `${match[1].padStart(2, "0")}:00`;
  return v;
}
