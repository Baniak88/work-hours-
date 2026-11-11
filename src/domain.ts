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
};
export type Timer = {
  jobId: string;
  start: number;
  breaks: Break[];
  pausedAt: number | null;
  rate: number;
  dailyHours: number;
  overtime: number;
};
export type State = {
  version: 1;
  jobs: Job[];
  entries: Entry[];
  timer: Timer | null;
  currency: "GBP" | "PLN" | "EUR";
  paidWeeks: string[];
};
export type Slice = {
  entry: Entry;
  date: string;
  minutes: number;
  regular: number;
  extra: number;
  amount: number;
};
export const freshState = (): State => ({
  version: 1,
  jobs: [],
  entries: [],
  timer: null,
  currency: "GBP",
  paidWeeks: [],
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
  return minutesWorked(t.start, t.pausedAt ?? now, t.breaks);
}
export function finishTimer(t: Timer, now: number): Entry {
  return {
    id: uid(),
    jobId: t.jobId,
    start: t.start,
    end: now,
    breaks: [
      ...t.breaks,
      ...(t.pausedAt === null ? [] : [{ start: t.pausedAt, end: now }]),
    ],
    note: "",
    rate: t.rate,
    dailyHours: t.dailyHours,
    overtime: t.overtime,
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
        key = `${e.jobId}/${date}`;
      const minutes = minutesWorked(start, end, e.breaks),
        previous = used.get(key) ?? 0;
      const regular = Math.min(
          minutes,
          Math.max(0, e.dailyHours * 60 - previous),
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
    throw new Error("Nieprawidłowa kopia danych Work Hours (wersja 1).");
  };
  if (!input || typeof input !== "object") return fail();
  const s = input as State;
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
    s.version !== 1 ||
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
  return s;
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
    d.setHours(5, 40 + (i % 4), 0, 0);
    const end = new Date(d);
    end.setHours(16, i % 3 === 0 ? 15 : 0);
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
    });
  }
  return state;
}
