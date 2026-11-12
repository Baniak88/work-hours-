export type Job = {
  id: string;
  name: string;
  rate: number;
  dailyHours: number;
  overtime: number;
  color: string;
  archived?: boolean;
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
export type Entry = {
  id: string;
  jobId: string;
  start: number;
  end: number;
  breaks: Break[];
  note: string;
  rate: number;
  dailyHours: number;
  overtime: number;
  shift?: ShiftRecord;
  autoStopped?: boolean;
};
export type Timer = {
  jobId: string;
  start: number;
  breaks: Break[];
  pausedAt: number | null;
  rate: number;
  dailyHours: number;
  overtime: number;
  shift?: ShiftRecord;
  plannedEnd?: number;
};
export type State = {
  version: 2;
  jobs: Job[];
  entries: Entry[];
  timer: Timer | null;
  currency: "GBP" | "PLN" | "EUR";
  paidWeeks: string[];
  shifts: Shift[];
  preferredShiftId: string;
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
  version: 2,
  jobs: [],
  entries: [],
  timer: null,
  currency: "GBP",
  paidWeeks: [],
  shifts: defaultShifts(),
  preferredShiftId: "day",
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
export function timeLabel(value: number) {
  return new Date(value).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
export function money(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amount,
  );
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
export function finishTimer(t: Timer, now: number): Entry {
  const end = Math.min(now, t.plannedEnd ?? Infinity);
  return {
    id: uid(),
    jobId: t.jobId,
    start: t.start,
    end,
    breaks: [
      ...t.breaks,
      ...(t.pausedAt === null ? [] : [{ start: t.pausedAt, end }]),
    ]
      .map((b) => ({ start: b.start, end: Math.min(b.end, end) }))
      .filter((b) => b.start < b.end),
    note: "",
    rate: t.rate,
    dailyHours: t.dailyHours,
    overtime: t.overtime,
    ...(t.shift ? { shift: t.shift } : {}),
    ...(t.plannedEnd !== undefined && now >= t.plannedEnd
      ? { autoStopped: true }
      : {}),
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
export function makeTimer(job: Job, shift: Shift, at: number): Timer {
  validateShift(shift);
  return {
    jobId: job.id,
    start: at,
    breaks: [],
    pausedAt: null,
    rate: job.rate,
    dailyHours: shift.normHours,
    overtime: job.overtime,
    shift: { ...shift, workDate: shiftWorkDate(shift, at) },
    ...(shift.autoStop ? { plannedEnd: shiftEnd(shift, at) } : {}),
  };
}
export function settleTimer(state: State, now: number): State {
  if (!state.timer?.plannedEnd || now < state.timer.plannedEnd) return state;
  return {
    ...state,
    timer: null,
    entries: [...state.entries, finishTimer(state.timer, now)],
  };
}
// Allocate chronological entries together so several shifts share one daily overtime allowance.
export function calculate(entries: Entry[]): Slice[] {
  const used = new Map<string, number>();
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
      const regular = Math.min(
          minutes,
          Math.max(0, (e.shift?.normHours ?? e.dailyHours) * 60 - previous),
        ),
        extra = minutes - regular;
      out.push({
        entry: e,
        date,
        minutes,
        regular,
        extra,
        amount: ((regular + extra * e.overtime) * e.rate) / 60,
      });
      used.set(key, previous + minutes);
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
      "Kwota",
      "Waluta",
      "Notatka",
    ],
    ...calculate(entries).map((s) => [
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
      s.entry.overtime,
      s.amount.toFixed(2),
      state.currency,
      s.entry.note,
    ]),
  ];
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
  const policy = (x: Job | Entry | Timer) =>
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
    (version !== 1 && version !== 2) ||
    !["GBP", "PLN", "EUR"].includes(s.currency) ||
    !Array.isArray(s.jobs) ||
    !Array.isArray(s.entries) ||
    !Array.isArray(s.paidWeeks) ||
    s.jobs.length > 1000 ||
    s.entries.length > 100000
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
        (j.archived === undefined || typeof j.archived === "boolean"),
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
    version === 2 &&
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
        text(e.note) &&
        isRecord(e.shift) &&
        (e.autoStopped === undefined || typeof e.autoStopped === "boolean") &&
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
  return version === 1
    ? { ...s, version: 2, shifts: defaultShifts(), preferredShiftId: "day" }
    : s;
}
export function demoState(): State {
  const state = freshState();
  const job: Job = {
    id: uid(),
    name: "Bowmill",
    rate: 23.15,
    dailyHours: 8,
    overtime: 1.25,
    color: "#B4F272",
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
      shift: { ...selectedShift, workDate: dateKey(d) },
    });
  }
  return state;
}
