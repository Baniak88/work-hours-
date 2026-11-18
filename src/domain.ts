import { translateText } from "./i18n";
export type OvertimePolicy = {
  overtimeMode?: "multiplier" | "fixed";
  overtimeRate?: number;
  shiftAllowancePercent?: number;
  allowanceOnOvertime?: boolean;
  overtimeBase?: "basic" | "withAllowance";
  overtimeThreshold?: "shift" | "week" | "both";
  weeklyHours?: number;
};
export type Job = OvertimePolicy & {
  id: string;
  name: string;
  rate: number;
  dailyHours: number;
  overtime: number;
  color: string;
  archived?: boolean;
  demo?: boolean;
};
export type Break = { start: number; end: number };
export type Shift = {
  id: string;
  name: string;
  kind: "day" | "night";
  startTime: string;
  endTime: string;
  normHours: number;
  autoStop: boolean;
};
export type ShiftRecord = Shift & { workDate: string };
export type Entry = OvertimePolicy & {
  id: string;
  jobId: string;
  start: number;
  end: number;
  breaks: Break[];
  automaticBreaks?: Break[];
  note: string;
  rate: number;
  dailyHours: number;
  overtime: number;
  shift?: ShiftRecord;
  autoStopped?: boolean;
  demo?: boolean;
};
export type Timer = OvertimePolicy & {
  jobId: string;
  start: number;
  breaks: Break[];
  pausedAt: number | null;
  rate: number;
  dailyHours: number;
  overtime: number;
  shift?: ShiftRecord;
  plannedEnd?: number;
  autoBreakMinutes?: number;
  priorBreakMilliseconds?: number;
};
export type Holiday = { id: string; date: string; hours: number; rate: number };
export type State = {
  version: 7;
  jobs: Job[];
  entries: Entry[];
  timer: Timer | null;
  currency: "GBP" | "PLN" | "EUR";
  paidWeeks: string[];
  shifts: Shift[];
  preferredShiftId: string;
  holidays: Holiday[];
  defaultBreakMinutes: number;
  automaticBreak: boolean;
  holidaySettings?: Record<string, { days: number; rate: number }>;
  timeFormat?: "clock" | "decimal";
  calendarMetric?: "hours" | "money";
  language?: "pl" | "en";
  theme?: "navy" | "graphite" | "light";
};
export type Slice = {
  entry: Entry;
  date: string;
  minutes: number;
  regular: number;
  extra: number;
  amount: number;
};
export const defaultShifts = (): Shift[] => [
  {
    id: "day",
    name: "Zmiana dzienna",
    kind: "day",
    startTime: "06:00",
    endTime: "14:00",
    normHours: 8,
    autoStop: false,
  },
  {
    id: "night",
    name: "Zmiana nocna",
    kind: "night",
    startTime: "17:30",
    endTime: "03:00",
    normHours: 8,
    autoStop: false,
  },
];
export const freshState = (): State => ({
  version: 7,
  jobs: [],
  entries: [],
  timer: null,
  currency: "GBP",
  paidWeeks: [],
  shifts: defaultShifts(),
  preferredShiftId: "day",
  holidays: [],
  defaultBreakMinutes: 0,
  automaticBreak: false,
});
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export function dateKey(value: number | Date) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekKey(value: number | Date) {
  const d = new Date(value);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}
export const localDate = (key: string) => new Date(`${key}T12:00:00`);
export function holidayDates(start: string, days: number): string[] {
  parseLocal(start, "12:00");
  if (!Number.isInteger(days) || days < 1 || days > 366)
    throw new Error("Podaj od 1 do 366 dni urlopu.");
  const date = localDate(start);
  return Array.from({ length: days }, () => {
    const result = dateKey(date);
    date.setDate(date.getDate() + 1);
    return result;
  });
}
export function timeLabel(value: number) {
  return new Date(value).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function duration(
  minutes: number,
  format: "clock" | "decimal" = "clock",
  language: "pl" | "en" = "pl",
) {
  if (format === "decimal")
    return (Math.max(0, minutes) / 60).toLocaleString(
      language === "en" ? "en-GB" : "pl-PL",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      },
    );
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
// Percent is the full share of Basic: 150% = 1.5 × Basic. For convenience,
// 1–10 entered as a multiplier is normalized to 100–1000% before saving.
export function overtimePercentInput(input: string) {
  const explicitPercent = input.trim().endsWith("%");
  const cleaned = input.trim().replace(/%$/, "").trim().replace(",", ".");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned))
    throw new Error("Wpisz procent nadgodzin, np. 150, lub mnożnik, np. 1,5.");
  const value = Number(cleaned);
  const percent =
    !explicitPercent && value >= 1 && value <= 10 ? value * 100 : value;
  if (!Number.isFinite(percent) || percent < 100 || percent > 1000)
    throw new Error(
      "Nadgodziny ustaw od 100% do 1000% wybranej podstawy (od ×1 do ×10).",
    );
  return percent;
}
export function policyOvertimePercent(
  policy: OvertimePolicy & { rate: number; overtime: number },
) {
  const base = overtimeBaseRate(policy);
  return policy.overtimeMode === "fixed"
    ? base > 0
      ? (overtimeHourlyRate(policy) / base) * 100
      : null
    : policy.overtime * 100;
}
export function parseWeeklyNormHours(input: string) {
  const value = input.trim();
  if (/^\d{1,3}:[0-5]\d$/.test(value)) {
    const [hours, minutes] = value.split(":").map(Number);
    const norm = hours + minutes / 60;
    if (norm > 0 && norm <= 168) return norm;
  }
  throw new Error(
    "Wpisz normę tygodniową jako godziny:minuty, np. 40:00 lub 37:30 (do 168:00).",
  );
}
export function parseNormHours(input: string) {
  const value = input.trim();
  if (/^\d{1,2}:[0-5]\d$/.test(value)) {
    const [hours, minutes] = value.split(":").map(Number);
    const norm = hours + minutes / 60;
    if (norm > 0 && norm <= 24) return norm;
  }
  throw new Error(
    "Wpisz normę jako godziny:minuty, np. 08:00 lub 09:45 (do 24:00).",
  );
}
export function money(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amount,
  );
}
export function overtimeHourlyRate(
  policy: OvertimePolicy & { rate: number; overtime: number },
) {
  return policy.overtimeMode === "fixed"
    ? policy.overtimeRate!
    : overtimeBaseRate(policy) * policy.overtime;
}
export function overtimeBaseRate(policy: OvertimePolicy & { rate: number }) {
  return (
    policy.rate +
    (policy.overtimeBase === "withAllowance" ? allowanceHourlyRate(policy) : 0)
  );
}
export function overtimeAllowanceHourlyRate(
  policy: OvertimePolicy & { rate: number; overtime: number },
) {
  if (
    policy.overtimeBase === "withAllowance" &&
    policy.overtimeMode !== "fixed"
  )
    return allowanceHourlyRate(policy) * policy.overtime;
  return !policy.overtimeBase && policy.allowanceOnOvertime
    ? allowanceHourlyRate(policy)
    : 0;
}
export function extraHourlyRate(
  policy: OvertimePolicy & { rate: number; overtime: number },
) {
  return (
    overtimeHourlyRate(policy) +
    (!policy.overtimeBase && policy.allowanceOnOvertime
      ? allowanceHourlyRate(policy)
      : 0)
  );
}
export function overtimeSnapshot(policy: OvertimePolicy): OvertimePolicy {
  const overtime: OvertimePolicy =
    policy.overtimeMode === "fixed"
      ? { overtimeMode: "fixed", overtimeRate: policy.overtimeRate }
      : policy.overtimeMode === "multiplier"
        ? { overtimeMode: "multiplier" }
        : {};
  return {
    ...overtime,
    ...(policy.overtimeBase !== undefined
      ? { overtimeBase: policy.overtimeBase }
      : {}),
    ...(policy.overtimeThreshold !== undefined
      ? { overtimeThreshold: policy.overtimeThreshold }
      : {}),
    ...(policy.weeklyHours !== undefined
      ? { weeklyHours: policy.weeklyHours }
      : {}),
    ...(policy.shiftAllowancePercent !== undefined
      ? {
          shiftAllowancePercent: policy.shiftAllowancePercent,
          allowanceOnOvertime: policy.allowanceOnOvertime ?? false,
        }
      : {}),
  };
}
export function allowanceHourlyRate(policy: OvertimePolicy & { rate: number }) {
  return (policy.rate * (policy.shiftAllowancePercent ?? 0)) / 100;
}
export function validateOvertime(policy: OvertimePolicy) {
  if (
    policy.overtimeBase !== undefined &&
    !["basic", "withAllowance"].includes(policy.overtimeBase)
  )
    throw new Error("Wybierz podstawę nadgodzin: Basic albo Basic + dodatek.");
  if (
    policy.overtimeThreshold !== undefined &&
    !["shift", "week", "both"].includes(policy.overtimeThreshold)
  )
    throw new Error("Wybierz próg nadgodzin: zmiana, tydzień albo oba.");
  if (
    policy.weeklyHours !== undefined &&
    (!Number.isFinite(policy.weeklyHours) ||
      policy.weeklyHours <= 0 ||
      policy.weeklyHours > 168)
  )
    throw new Error(
      "Norma tygodniowa musi być większa od 0 i nie przekraczać 168 godzin.",
    );
  if (
    policy.overtimeThreshold &&
    policy.overtimeThreshold !== "shift" &&
    policy.weeklyHours === undefined
  )
    throw new Error("Ustaw tygodniową normę godzin.");
  if (
    policy.shiftAllowancePercent !== undefined &&
    (!Number.isFinite(policy.shiftAllowancePercent) ||
      policy.shiftAllowancePercent < 0 ||
      policy.shiftAllowancePercent > 1000)
  )
    throw new Error("Shift allowance musi wynosić od 0 do 1000% stawki Basic.");
  if (
    policy.allowanceOnOvertime !== undefined &&
    typeof policy.allowanceOnOvertime !== "boolean"
  )
    throw new Error("Wybierz, czy dodatek dotyczy nadgodzin.");
  if (
    policy.overtimeMode !== undefined &&
    !["fixed", "multiplier"].includes(policy.overtimeMode)
  )
    throw new Error("Wybierz sposób naliczania nadgodzin.");
  if (
    policy.overtimeRate !== undefined &&
    (!Number.isFinite(policy.overtimeRate) ||
      policy.overtimeRate < 0 ||
      policy.overtimeRate > 100000)
  )
    throw new Error("Stawka nadgodzin musi wynosić od 0 do 100 000.");
  if (policy.overtimeMode === "fixed" && policy.overtimeRate === undefined)
    throw new Error("Podaj stawkę nadgodzin za godzinę.");
}
export function minutesWorked(start: number, end: number, breaks: Break[]) {
  return Math.max(
    0,
    (end -
      start -
      breaks.reduce(
        (n, b) =>
          n + Math.max(0, Math.min(end, b.end) - Math.max(start, b.start)),
        0,
      )) /
      60000,
  );
}
export function timerMinutes(t: Timer, now: number) {
  return minutesWorked(
    t.start,
    Math.min(t.pausedAt ?? now, now, t.plannedEnd ?? Infinity),
    t.breaks,
  );
}
export function formatCountdown(minutes: number) {
  const seconds = Math.max(0, Math.ceil(Math.max(0, minutes) * 60 - 1e-7));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function timerDayMinutes(t: Timer, now: number, date: string) {
  const start = parseLocal(date, "00:00"),
    next = new Date(start);
  next.setDate(next.getDate() + 1);
  return minutesWorked(
    Math.max(t.start, start),
    Math.min(next.getTime(), t.pausedAt ?? now, now, t.plannedEnd ?? Infinity),
    t.breaks,
  );
}
export function timerWeekMinutes(t: Timer, now: number) {
  const start = parseLocal(weekKey(now), "00:00");
  const next = new Date(start);
  next.setDate(next.getDate() + 7);
  return minutesWorked(
    Math.max(t.start, start),
    Math.min(next.getTime(), t.pausedAt ?? now, now, t.plannedEnd ?? Infinity),
    t.breaks,
  );
}
export function timerBreaksAtEnd(
  t: Timer,
  end: number,
  applyAutomatic = true,
): Break[] {
  const manual = [
    ...t.breaks,
    ...(t.pausedAt === null ? [] : [{ start: t.pausedAt, end }]),
  ]
    .map((b) => ({
      start: Math.max(t.start, b.start),
      end: Math.min(b.end, end),
    }))
    .filter((b) => b.start < b.end);
  if (!applyAutomatic || !(t.autoBreakMinutes && t.autoBreakMinutes > 0))
    return manual;
  const manualMs = manual.reduce((sum, b) => sum + b.end - b.start, 0);
  let remaining = Math.max(
    0,
    t.autoBreakMinutes * 60000 - (t.priorBreakMilliseconds ?? 0) - manualMs,
  );
  let cursor = end;
  const automatic: Break[] = [];
  for (let i = manual.length - 1; i >= -1 && remaining > 0; i--) {
    const gapStart = i >= 0 ? manual[i].end : t.start;
    const amount = Math.min(remaining, Math.max(0, cursor - gapStart));
    if (amount > 0) {
      automatic.push({ start: cursor - amount, end: cursor });
      remaining -= amount;
    }
    if (i >= 0) cursor = manual[i].start;
  }
  return [...manual, ...automatic].sort((a, b) => a.start - b.start);
}
export function finishTimer(
  t: Timer,
  now: number,
  id = uid(),
  applyAutomatic = true,
): Entry {
  const end = Math.min(now, t.plannedEnd ?? Infinity);
  const manual = timerBreaksAtEnd(t, end, false);
  const breaks = timerBreaksAtEnd(t, end, applyAutomatic);
  const automaticBreaks = breaks.filter(
    (pause) =>
      !manual.some(
        (recorded) =>
          recorded.start === pause.start && recorded.end === pause.end,
      ),
  );
  return {
    id,
    jobId: t.jobId,
    start: t.start,
    end,
    breaks,
    ...(automaticBreaks.length ? { automaticBreaks } : {}),
    note: "",
    rate: t.rate,
    dailyHours: t.dailyHours,
    overtime: t.overtime,
    ...overtimeSnapshot(t),
    ...(t.shift ? { shift: t.shift } : {}),
    ...(t.plannedEnd !== undefined && now >= t.plannedEnd
      ? { autoStopped: true }
      : {}),
  };
}
// When a shift has several sessions, later manual breaks replace earlier
// automatic estimates. Historical manually recorded breaks are never removed.
export function finishShift(state: State, timer: Timer, now: number): State {
  const entry = finishTimer(timer, now);
  const all = [...state.entries, entry];
  if (!timer.autoBreakMinutes || !timer.shift)
    return { ...state, timer: null, entries: all };
  const sameShift = (item: Entry) =>
    item.jobId === timer.jobId &&
    item.shift?.id === timer.shift?.id &&
    item.shift?.workDate === timer.shift?.workDate;
  const related = all.filter(sameShift);
  const isAutomatic = (item: Entry, pause: Break) =>
    (item.automaticBreaks ?? []).some(
      (auto) => auto.start === pause.start && auto.end === pause.end,
    );
  const manualMilliseconds = related.reduce(
    (total, item) =>
      total +
      item.breaks
        .filter((pause) => !isAutomatic(item, pause))
        .reduce((sum, pause) => sum + pause.end - pause.start, 0),
    0,
  );
  let remaining = Math.max(
    0,
    timer.autoBreakMinutes * 60000 - manualMilliseconds,
  );
  const autoParts = related
    .flatMap((item) =>
      (item.automaticBreaks ?? []).map((pause) => ({
        entryId: item.id,
        pause,
      })),
    )
    .sort((a, b) => b.pause.end - a.pause.end);
  const kept = new Map<string, Break[]>();
  for (const { entryId, pause } of autoParts) {
    const duration = Math.min(remaining, pause.end - pause.start);
    if (duration > 0)
      kept.set(entryId, [
        ...(kept.get(entryId) ?? []),
        { start: pause.end - duration, end: pause.end },
      ]);
    remaining -= duration;
  }
  return {
    ...state,
    timer: null,
    entries: all.map((item) => {
      if (!sameShift(item) || !item.automaticBreaks?.length) return item;
      const automaticBreaks = (kept.get(item.id) ?? []).sort(
        (a, b) => a.start - b.start,
      );
      return {
        ...item,
        breaks: [
          ...item.breaks.filter((pause) => !isAutomatic(item, pause)),
          ...automaticBreaks,
        ].sort((a, b) => a.start - b.start),
        automaticBreaks: automaticBreaks.length ? automaticBreaks : undefined,
      };
    }),
  };
}
// A preview follows the exact same pay rules as the eventual saved entry.
// It never mutates or persists the running timer.
export function previewSlices(
  entries: Entry[],
  timer: Timer | null,
  now: number,
): Slice[] {
  if (!timer || Math.min(now, timer.plannedEnd ?? Infinity) <= timer.start)
    return calculate(entries);
  let id = "__active_timer_preview__";
  while (entries.some((entry) => entry.id === id)) id += "_";
  return calculate([...entries, finishTimer(timer, now, id, false)]);
}
export function updateActiveWeeklyPolicy(
  timer: Timer | null,
  job: Job,
): Timer | null {
  if (!timer || timer.jobId !== job.id) return timer;
  return {
    ...timer,
    overtimeThreshold: job.overtimeThreshold,
    weeklyHours: job.weeklyHours,
  };
}
export function setWeeklyTarget(
  state: State,
  jobId: string,
  weeklyHours: number,
  recalculateHistory: boolean,
): State {
  const original = state.jobs.find((job) => job.id === jobId);
  if (!original) throw new Error("Wybierz projekt.");
  const updated: Job = { ...original, overtimeThreshold: "week", weeklyHours };
  validateOvertime(updated);
  return {
    ...state,
    jobs: state.jobs.map((job) => (job.id === jobId ? updated : job)),
    timer: updateActiveWeeklyPolicy(state.timer, updated),
    entries: recalculateHistory
      ? state.entries.map((entry) =>
          entry.jobId === jobId
            ? { ...entry, overtimeThreshold: "week", weeklyHours }
            : entry,
        )
      : state.entries,
  };
}
export function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validateShift(shift: Shift) {
  if (!shift.name.trim() || shift.name.length > 80)
    throw new Error("Podaj nazwę zmiany (do 80 znaków).");
  if (!validTime(shift.startTime) || !validTime(shift.endTime))
    throw new Error("Godziny zmiany wpisz jako GG:MM, np. 17:30 i 03:00.");
  if (shift.startTime === shift.endTime)
    throw new Error("Początek i koniec zmiany muszą być różne.");
  if (
    !Number.isFinite(shift.normHours) ||
    shift.normHours <= 0 ||
    shift.normHours > 24
  )
    throw new Error("Norma musi być większa od 0 i nie przekraczać 24 godzin.");
}
export function shiftDuration(shift: Shift) {
  const minute = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  return (minute(shift.endTime) - minute(shift.startTime) + 1440) % 1440;
}
export function shiftWorkDate(shift: Shift, at: number) {
  const day = new Date(at);
  if (shift.endTime < shift.startTime && timeLabel(at) < shift.endTime)
    day.setDate(day.getDate() - 1);
  return dateKey(day);
}
export function shiftEnd(shift: Shift, at: number) {
  const day = new Date(at);
  const [h, m] = shift.endTime.split(":").map(Number);
  day.setHours(h, m, 0, 0);
  if (day.getTime() <= at) day.setDate(day.getDate() + 1);
  return day.getTime();
}
export function priorShiftBreakMilliseconds(
  entries: Entry[],
  jobId: string,
  shift: Shift,
  at: number,
  limitMinutes: number,
) {
  const workDate = shiftWorkDate(shift, at);
  const recorded = entries
    .filter(
      (entry) =>
        entry.jobId === jobId &&
        entry.shift?.id === shift.id &&
        entry.shift.workDate === workDate,
    )
    .reduce(
      (sum, entry) =>
        sum + entry.breaks.reduce((n, pause) => n + pause.end - pause.start, 0),
      0,
    );
  return Math.min(limitMinutes * 60000, Math.max(0, recorded));
}
export function syncTimerBreakContext(state: State): State {
  const timer = state.timer;
  if (!timer?.shift || !timer.autoBreakMinutes) return state;
  const prior = priorShiftBreakMilliseconds(
    state.entries,
    timer.jobId,
    timer.shift,
    timer.start,
    timer.autoBreakMinutes,
  );
  return prior === (timer.priorBreakMilliseconds ?? 0)
    ? state
    : { ...state, timer: { ...timer, priorBreakMilliseconds: prior } };
}
export function makeTimer(
  job: Job,
  shift: Shift,
  at: number,
  autoBreakMinutes = 0,
  priorBreakMilliseconds = 0,
): Timer {
  validateShift(shift);
  if (
    !Number.isInteger(autoBreakMinutes) ||
    autoBreakMinutes < 0 ||
    autoBreakMinutes > 1440
  )
    throw new Error("Podaj liczbę minut od 0 do 1440.");
  if (
    !Number.isFinite(priorBreakMilliseconds) ||
    priorBreakMilliseconds < 0 ||
    priorBreakMilliseconds > autoBreakMinutes * 60000
  )
    throw new Error("Nieprawidłowa wcześniejsza przerwa.");
  return {
    jobId: job.id,
    start: at,
    breaks: [],
    pausedAt: null,
    ...(autoBreakMinutes > 0 ? { autoBreakMinutes } : {}),
    ...(priorBreakMilliseconds > 0 ? { priorBreakMilliseconds } : {}),
    rate: job.rate,
    dailyHours: shift.normHours,
    overtime: job.overtime,
    ...overtimeSnapshot(job),
    shift: { ...shift, workDate: shiftWorkDate(shift, at) },
    ...(shift.autoStop ? { plannedEnd: shiftEnd(shift, at) } : {}),
  };
}
export function adjustTimerStart(
  timer: Timer,
  start: number,
  entries: Entry[],
  now: number,
): Timer {
  if (
    !Number.isFinite(start) ||
    start <= 0 ||
    start > now ||
    now - start > 7 * 86400000
  )
    throw new Error(
      "Początek licznika musi być w ciągu ostatnich 7 dni i nie może być w przyszłości.",
    );
  if (entries.some((entry) => entry.end > start))
    throw new Error("Początek nakłada się na zapisaną zmianę.");
  if (
    timer.breaks.some((pause) => pause.start < start) ||
    (timer.pausedAt !== null && timer.pausedAt < start)
  )
    throw new Error(
      "Początek nie może wypadać po rozpoczęciu zapisanej przerwy.",
    );
  const plannedEnd = timer.shift?.autoStop
    ? shiftEnd(timer.shift, start)
    : undefined;
  if (plannedEnd !== undefined && plannedEnd <= now)
    throw new Error(
      "Planowany automatyczny koniec już minął. Dodaj tę zmianę jako wpis w kalendarzu.",
    );
  return {
    ...timer,
    start,
    ...(timer.shift
      ? {
          shift: {
            ...timer.shift,
            workDate: shiftWorkDate(timer.shift, start),
          },
        }
      : {}),
    ...(timer.shift && timer.autoBreakMinutes
      ? {
          priorBreakMilliseconds: priorShiftBreakMilliseconds(
            entries,
            timer.jobId,
            timer.shift,
            start,
            timer.autoBreakMinutes,
          ),
        }
      : {}),
    ...(plannedEnd !== undefined ? { plannedEnd } : {}),
  };
}
export function settleTimer(state: State, now: number): State {
  if (!state.timer?.plannedEnd || now < state.timer.plannedEnd) return state;
  const synchronized = syncTimerBreakContext(state);
  return finishShift(synchronized, synchronized.timer!, now);
}
// Evaluate entries chronologically. Shift/day and Monday-week counters include paid
// minutes. Taking the smaller remaining allowance implements the union of both
// thresholds without ever paying the same minute as overtime twice.
export function calculate(entries: Entry[]): Slice[] {
  const used = new Map<string, number>();
  const weekUsed = new Map<string, number>();
  const out: Slice[] = [];
  for (const e of [...entries].sort(
    (a, b) => a.start - b.start || a.id.localeCompare(b.id),
  )) {
    let start = e.start;
    while (start < e.end) {
      const next = new Date(start);
      next.setHours(24, 0, 0, 0);
      const end = Math.min(e.end, next.getTime());
      const date = dateKey(start),
        key = e.shift
          ? `${e.jobId}/shift/${e.shift.id}/${e.shift.workDate}`
          : `${e.jobId}/${date}`;
      const minutes = minutesWorked(start, end, e.breaks),
        previous = used.get(key) ?? 0;
      const weeklyKey = `${e.jobId}/${weekKey(start)}`;
      const previousWeekly = weekUsed.get(weeklyKey) ?? 0;
      const threshold = e.overtimeThreshold ?? "shift";
      const shiftRemaining = Math.max(
        0,
        (e.shift?.normHours ?? e.dailyHours) * 60 - previous,
      );
      const weekRemaining = Math.max(
        0,
        (e.weeklyHours ?? 40) * 60 - previousWeekly,
      );
      const regular = Math.min(
          minutes,
          threshold === "week"
            ? weekRemaining
            : threshold === "both"
              ? Math.min(shiftRemaining, weekRemaining)
              : shiftRemaining,
        ),
        extra = minutes - regular;
      out.push({
        entry: e,
        date,
        minutes,
        regular,
        extra,
        amount:
          (regular * (e.rate + allowanceHourlyRate(e)) +
            extra * extraHourlyRate(e)) /
          60,
      });
      used.set(key, previous + minutes);
      weekUsed.set(weeklyKey, previousWeekly + minutes);
      start = end;
    }
  }
  return out;
}
export const totals = (slices: Slice[]) =>
  slices.reduce(
    (t, s) => ({
      minutes: t.minutes + s.minutes,
      regular: t.regular + s.regular,
      extra: t.extra + s.extra,
      amount: t.amount + s.amount,
    }),
    { minutes: 0, regular: 0, extra: 0, amount: 0 },
  );
export function parseLocal(date: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error("Wpisz datę RRRR-MM-DD i godzinę GG:MM.");
  const value = new Date(`${date}T${time}:00`);
  if (
    !Number.isFinite(value.getTime()) ||
    dateKey(value) !== date ||
    timeLabel(value.getTime()) !== time
  )
    throw new Error("Ta data lub godzina nie istnieje.");
  return value.getTime();
}
export function checkEntry(
  entry: Entry,
  entries: Entry[],
  timer: Timer | null,
) {
  if (entry.end <= entry.start)
    throw new Error(
      "Koniec pracy musi wypadać po rozpoczęciu. Dla nocnej zmiany wybierz następny dzień.",
    );
  if (entry.end > Date.now() + 60000)
    throw new Error("Nie można zapisać pracy z przyszłości.");
  if (entry.end - entry.start > 7 * 86400000)
    throw new Error("Jeden wpis może obejmować maksymalnie 7 dni.");
  if (
    entry.breaks.some(
      (b) => b.start < entry.start || b.end > entry.end || b.end < b.start,
    ) ||
    minutesWorked(entry.start, entry.end, entry.breaks) <= 0
  )
    throw new Error("Przerwa musi być krótsza od czasu zmiany.");
  if (
    entries.some(
      (e) => e.id !== entry.id && entry.start < e.end && entry.end > e.start,
    ) ||
    (timer && entry.end > timer.start)
  )
    throw new Error("Ten wpis nakłada się na inną zmianę lub aktywny licznik.");
}
export function csv(state: State, entries = state.entries) {
  const selected = new Set(entries.map((e) => e.id));
  const context = [
    ...new Map([...state.entries, ...entries].map((e) => [e.id, e])).values(),
  ];
  const quote = (value: unknown) => {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [
    [
      "Data",
      "Projekt",
      "Zmiana",
      "Typ zmiany",
      "Dzień zmiany",
      "Norma godzin",
      "Początek zmiany",
      "Koniec zmiany",
      "Godziny",
      "Zwykłe",
      "Nadgodziny",
      "Stawka",
      "Mnożnik nadgodzin",
      "Sposób naliczania nadgodzin",
      "Stawka nadgodzin za godzinę",
      "Kwota",
      "Waluta",
      "Notatka",
      "Shift allowance (%)",
      "Dodatek za godzinę",
      "Dodatek także za nadgodziny",
      "Kwota dodatku",
      "Podstawa nadgodzin",
      "Próg nadgodzin",
      "Norma tygodniowa (h)",
      "Tydzień od",
      "Łączna stawka nadgodzin za godzinę",
    ],
    ...calculate(context)
      .filter((s) => selected.has(s.entry.id))
      .map((s) => [
        s.date,
        state.jobs.find((j) => j.id === s.entry.jobId)?.name ?? "Projekt",
        s.entry.shift?.name ?? "Bez przypisanej zmiany",
        s.entry.shift?.kind === "night"
          ? "Nocna"
          : s.entry.shift?.kind === "day"
            ? "Dzienna"
            : "",
        s.entry.shift?.workDate ?? "",
        s.entry.shift?.normHours ?? s.entry.dailyHours,
        new Date(s.entry.start).toISOString(),
        new Date(s.entry.end).toISOString(),
        (s.minutes / 60).toFixed(4),
        (s.regular / 60).toFixed(4),
        (s.extra / 60).toFixed(4),
        s.entry.rate,
        s.entry.overtimeMode === "fixed" ? "" : s.entry.overtime,
        s.entry.overtimeMode === "fixed" ? "Stawka godzinowa" : "Mnożnik",
        overtimeHourlyRate(s.entry).toFixed(2),
        s.amount.toFixed(2),
        state.currency,
        s.entry.note,
        s.entry.shiftAllowancePercent ?? 0,
        allowanceHourlyRate(s.entry).toFixed(2),
        s.entry.overtimeBase === "withAllowance" ||
        (!s.entry.overtimeBase && s.entry.allowanceOnOvertime)
          ? "Tak"
          : "Nie",
        (
          (s.regular * allowanceHourlyRate(s.entry) +
            s.extra * overtimeAllowanceHourlyRate(s.entry)) /
          60
        ).toFixed(2),
        translateText(
          s.entry.overtimeBase === "withAllowance"
            ? "Basic + dodatek"
            : s.entry.overtimeBase === "basic"
              ? "Samo Basic"
              : s.entry.allowanceOnOvertime
                ? "Dotychczas: Basic × procent + dodatek"
                : "Samo Basic",
          state.language,
        ),
        translateText(
          s.entry.overtimeThreshold === "week"
            ? "Tydzień"
            : s.entry.overtimeThreshold === "both"
              ? "Zmiana lub tydzień"
              : "Zmiana",
          state.language,
        ),
        s.entry.weeklyHours ?? 40,
        weekKey(localDate(s.date)),
        extraHourlyRate(s.entry).toFixed(2),
      ]),
  ];
  rows[0] = rows[0].map((header) =>
    translateText(String(header), state.language),
  );
  return "\uFEFF" + rows.map((r) => r.map(quote).join(";")).join("\r\n");
}
export function validateBackup(input: unknown): State {
  const fail = (): never => {
    throw new Error("Nieprawidłowa kopia danych Work Hours.");
  };
  if (!input || typeof input !== "object") return fail();
  const s = input as State;
  const version = (input as { version: unknown }).version;
  const number = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const text = (v: unknown) => typeof v === "string" && v.length <= 10000;
  const validOvertime = (x: OvertimePolicy) => {
    try {
      validateOvertime(x);
      return true;
    } catch {
      return false;
    }
  };
  const policy = (x: Job | Entry | Timer) =>
    validOvertime(x) &&
    number(x.rate) &&
    x.rate >= 0 &&
    x.rate <= 100000 &&
    number(x.dailyHours) &&
    x.dailyHours > 0 &&
    x.dailyHours <= 24 &&
    number(x.overtime) &&
    x.overtime >= 1 &&
    x.overtime <= 10;
  const breaks = (b: Break[], start: number, end: number) =>
    Array.isArray(b) &&
    b.every(
      (p, i) =>
        p &&
        number(p.start) &&
        number(p.end) &&
        p.start >= start &&
        p.end >= p.start &&
        p.end <= end &&
        (i === 0 || p.start >= b[i - 1].end),
    );
  if (
    (version !== 1 &&
      version !== 2 &&
      version !== 3 &&
      version !== 4 &&
      version !== 5 &&
      version !== 6 &&
      version !== 7) ||
    !["GBP", "PLN", "EUR"].includes(s.currency) ||
    (s.language !== undefined && !["pl", "en"].includes(s.language)) ||
    (s.theme !== undefined &&
      !["navy", "graphite", "light"].includes(s.theme)) ||
    (s.timeFormat !== undefined &&
      !["clock", "decimal"].includes(s.timeFormat)) ||
    (s.calendarMetric !== undefined &&
      !["hours", "money"].includes(s.calendarMetric)) ||
    !Array.isArray(s.jobs) ||
    !Array.isArray(s.entries) ||
    !Array.isArray(s.paidWeeks) ||
    s.jobs.length > 1000 ||
    s.entries.length > 100000
  )
    return fail();
  if (
    (version === 6 || version === 7) &&
    (!Array.isArray(s.holidays) ||
      s.holidays.length > 100000 ||
      !s.holidays.every(
        (h) =>
          h &&
          text(h.id) &&
          !!h.id &&
          typeof h.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(h.date) &&
          Number.isFinite(localDate(h.date).getTime()) &&
          dateKey(localDate(h.date)) === h.date &&
          number(h.hours) &&
          h.hours > 0 &&
          h.hours <= 24 &&
          number(h.rate) &&
          h.rate >= 0 &&
          h.rate <= 100000,
      ) ||
      new Set(s.holidays.map((h) => h.id)).size !== s.holidays.length ||
      new Set(s.holidays.map((h) => h.date)).size !== s.holidays.length)
  )
    return fail();
  if (
    (version === 6 || version === 7) &&
    s.holidaySettings !== undefined &&
    (!s.holidaySettings ||
      typeof s.holidaySettings !== "object" ||
      Array.isArray(s.holidaySettings) ||
      Object.entries(s.holidaySettings).some(
        ([year, value]) =>
          !/^\d{4}$/.test(year) ||
          !value ||
          !Number.isInteger(value.days) ||
          value.days < 0 ||
          value.days > 366 ||
          !number(value.rate) ||
          value.rate < 0 ||
          value.rate > 100000,
      ))
  )
    return fail();
  if (
    !s.jobs.every(
      (j) =>
        j &&
        text(j.id) &&
        !!j.id &&
        text(j.name) &&
        !!j.name.trim() &&
        policy(j) &&
        /^#[a-f\d]{6}$/i.test(j.color) &&
        (j.archived === undefined || typeof j.archived === "boolean") &&
        (j.demo === undefined || typeof j.demo === "boolean"),
    )
  )
    return fail();
  if (
    new Set(s.jobs.map((j) => j.id)).size !== s.jobs.length ||
    new Set(s.entries.map((e) => e.id)).size !== s.entries.length
  )
    return fail();
  const ids = new Set(s.jobs.map((j) => j.id));
  const isShift = (v: Shift) => {
    if (
      !v ||
      !text(v.id) ||
      !v.id ||
      !text(v.name) ||
      !["day", "night"].includes(v.kind) ||
      typeof v.autoStop !== "boolean"
    )
      return false;
    try {
      validateShift(v);
      return true;
    } catch {
      return false;
    }
  };
  const isRecord = (v: ShiftRecord | undefined) =>
    v === undefined ||
    (isShift(v) &&
      typeof v.workDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.workDate) &&
      Number.isFinite(localDate(v.workDate).getTime()) &&
      dateKey(localDate(v.workDate)) === v.workDate);
  if (
    version !== 1 &&
    (!Array.isArray(s.shifts) ||
      s.shifts.length === 0 ||
      s.shifts.length > 100 ||
      !s.shifts.every(isShift) ||
      new Set(s.shifts.map((x) => x.id)).size !== s.shifts.length ||
      !s.shifts.some((x) => x.id === s.preferredShiftId))
  )
    return fail();
  if (
    !s.entries.every(
      (e) =>
        e &&
        text(e.id) &&
        !!e.id &&
        ids.has(e.jobId) &&
        number(e.start) &&
        number(e.end) &&
        e.start > 0 &&
        e.end > e.start &&
        e.end <= Date.now() + 60000 &&
        breaks(e.breaks, e.start, e.end) &&
        (e.automaticBreaks === undefined ||
          (breaks(e.automaticBreaks, e.start, e.end) &&
            new Set(
              e.automaticBreaks.map((pause) => `${pause.start}/${pause.end}`),
            ).size === e.automaticBreaks.length &&
            e.automaticBreaks.every((pause) =>
              e.breaks.some(
                (recorded) =>
                  recorded.start === pause.start && recorded.end === pause.end,
              ),
            ))) &&
        text(e.note) &&
        isRecord(e.shift) &&
        (e.autoStopped === undefined || typeof e.autoStopped === "boolean") &&
        (e.demo === undefined || typeof e.demo === "boolean") &&
        policy(e),
    )
  )
    return fail();
  const sorted = [...s.entries].sort((a, b) => a.start - b.start);
  if (sorted.some((e, i) => i > 0 && e.start < sorted[i - 1].end))
    return fail();
  if (s.timer !== null) {
    const t = s.timer;
    if (
      !t ||
      !ids.has(t.jobId) ||
      !number(t.start) ||
      t.start <= 0 ||
      t.start > Date.now() ||
      !policy(t) ||
      (t.autoBreakMinutes !== undefined &&
        (!Number.isInteger(t.autoBreakMinutes) ||
          t.autoBreakMinutes < 0 ||
          t.autoBreakMinutes > 1440)) ||
      (t.priorBreakMilliseconds !== undefined &&
        (!number(t.priorBreakMilliseconds) ||
          t.priorBreakMilliseconds < 0 ||
          t.priorBreakMilliseconds > (t.autoBreakMinutes ?? 0) * 60000)) ||
      !isRecord(t.shift) ||
      (t.plannedEnd !== undefined &&
        (!number(t.plannedEnd) ||
          t.plannedEnd <= t.start ||
          t.plannedEnd - t.start > 2 * 86400000 ||
          !t.shift?.autoStop)) ||
      (t.pausedAt !== null &&
        (!number(t.pausedAt) ||
          t.pausedAt < t.start ||
          t.pausedAt > Date.now())) ||
      !breaks(t.breaks, t.start, t.pausedAt ?? Date.now()) ||
      sorted.some((e) => e.end > t.start)
    )
      return fail();
  }
  if (
    !s.paidWeeks.every(
      (k) =>
        typeof k === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(k) &&
        Number.isFinite(localDate(k).getTime()) &&
        weekKey(localDate(k)) === k,
    )
  )
    return fail();
  if (version === 7) {
    if (
      !Number.isInteger(s.defaultBreakMinutes) ||
      s.defaultBreakMinutes < 0 ||
      s.defaultBreakMinutes > 1440 ||
      typeof s.automaticBreak !== "boolean"
    )
      return fail();
    return s;
  }
  const jobs = s.jobs.map((job) => ({
    ...job,
    overtimeThreshold: "week" as const,
    weeklyHours: job.weeklyHours ?? 40,
  }));
  const timerJob = jobs.find((job) => job.id === s.timer?.jobId);
  return {
    ...s,
    version: 7,
    jobs,
    timer:
      s.timer && timerJob
        ? {
            ...s.timer,
            overtimeThreshold: "week",
            weeklyHours: s.timer.weeklyHours ?? timerJob.weeklyHours,
            autoBreakMinutes: undefined,
            priorBreakMilliseconds: undefined,
          }
        : s.timer,
    defaultBreakMinutes: 0,
    automaticBreak: false,
    ...(version === 1
      ? { shifts: defaultShifts(), preferredShiftId: "day" }
      : {}),
    ...(version === 1 ||
    version === 2 ||
    version === 3 ||
    version === 4 ||
    version === 5
      ? { holidays: [], holidaySettings: undefined }
      : {}),
  };
}
export function demoState(): State {
  const state = freshState();
  const job: Job = {
    id: uid(),
    name: "Bowmill",
    rate: 23.15,
    dailyHours: 8,
    overtime: 1.25,
    overtimeThreshold: "week",
    weeklyHours: 40,
    color: "#B4F272",
    demo: true,
  };
  state.jobs = [job];
  for (let i = 1; i <= 26; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const selectedShift = state.shifts[i % 3 === 0 ? 1 : 0];
    const night = selectedShift.kind === "night";
    d.setHours(night ? 17 : 5, night ? 30 : 40 + (i % 4), 0, 0);
    const end = new Date(d);
    if (night) end.setDate(end.getDate() + 1);
    end.setHours(night ? 3 : 16, 0, 0, 0);
    if (end.getTime() > Date.now()) continue;
    state.entries.push({
      id: uid(),
      demo: true,
      jobId: job.id,
      start: d.getTime(),
      end: end.getTime(),
      breaks: [
        {
          start: d.getTime() + 4 * 3600000,
          end: d.getTime() + 4 * 3600000 + 30 * 60000,
        },
      ],
      note: i % 4 === 0 ? "Zmiana poranna" : "",
      rate: job.rate,
      dailyHours: job.dailyHours,
      overtime: job.overtime,
      ...overtimeSnapshot(job),
      shift: { ...selectedShift, workDate: dateKey(d) },
    });
  }
  return state;
}
