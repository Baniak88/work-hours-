import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  duration,
  overtimePercentInput,
  extraHourlyRate,
  parseWeeklyNormHours,
  timerWeekMinutes,
  policyOvertimePercent,
  parseNormHours,
  allowanceHourlyRate,
  demoState,
  overtimeHourlyRate,
  checkEntry,
  csv,
  dateKey,
  finishTimer,
  freshState,
  parseLocal,
  timerMinutes,
  totals,
  validateBackup,
  weekKey,
  defaultShifts,
  makeTimer,
  adjustTimerStart,
  holidayDates,
  settleTimer,
  shiftEnd,
  shiftWorkDate,
  timerDayMinutes,
  validateShift,
  type Entry,
  type Job,
} from "../src/domain";
import { calendarDays, moveMonth } from "../src/calendar";
import {
  manualDates,
  moveManualDay,
  previousLocalDay,
} from "../src/manualEntry";
import { translateText } from "../src/i18n";
import { themes, themeColor } from "../src/themes";
import {
  clearWorkData,
  markLegacySamples,
  removeJobData,
  removeSampleData,
  sampleEntryIds,
} from "../src/dataManagement";
const job: Job = {
  id: "job",
  name: "Bowmill",
  rate: 20,
  dailyHours: 8,
  overtime: 1.25,
  color: "#B4F272",
};
const stamp = (d: string, t: string) => parseLocal(d, t);
test("manual earlier shifts retain the selected day and overnight end across DST", () => {
  const [day, night] = defaultShifts();
  assert.deepEqual(manualDates("2026-10-24", day), {
    startDate: "2026-10-24",
    endDate: "2026-10-24",
  });
  assert.deepEqual(manualDates("2026-10-24", night), {
    startDate: "2026-10-24",
    endDate: "2026-10-25",
  });
  assert.equal(previousLocalDay(stamp("2026-10-26", "01:30")), "2026-10-25");
  assert.equal(moveManualDay("2026-03-29", -1), "2026-03-28");
  assert.equal(moveManualDay("2026-03-29", 1), "2026-03-30");
  assert.throws(() => manualDates("2026-02-30", night));
  const dates = manualDates("2026-10-22", night);
  const result = {
    ...entry("2026-10-22", "17:30", "23:30"),
    start: stamp(dates.startDate, "17:30"),
    end: stamp(dates.endDate, "03:00"),
    breaks: [],
    shift: { ...night, workDate: dates.startDate },
  };
  checkEntry(result, [], null);
  assert.equal(totals(calculate([result])).minutes, 570);
});
test("adjusting a running overnight shift preserves breaks and rejects overlaps", () => {
  const shift = { ...defaultShifts()[1], autoStop: true };
  const timer = makeTimer(job, shift, stamp("2026-11-17", "18:00"));
  const now = stamp("2026-11-18", "01:00");
  const paused = {
    ...timer,
    breaks: [
      {
        start: stamp("2026-11-17", "20:00"),
        end: stamp("2026-11-17", "20:30"),
      },
    ],
  };
  const changed = adjustTimerStart(
    paused,
    stamp("2026-11-17", "17:30"),
    [],
    now,
  );
  assert.deepEqual(changed.breaks, paused.breaks);
  assert.equal(changed.plannedEnd, stamp("2026-11-18", "03:00"));
  assert.equal(changed.shift?.workDate, "2026-11-17");
  assert.throws(() =>
    adjustTimerStart(paused, stamp("2026-11-17", "20:15"), [], now),
  );
  assert.throws(() =>
    adjustTimerStart(
      paused,
      stamp("2026-11-17", "17:30"),
      [{ ...entry("2026-11-17", "16:00", "18:00") }],
      now,
    ),
  );
});
test("holiday records survive backup and invalid or duplicate dates are rejected", () => {
  const state = freshState();
  state.holidays = [{ id: "h1", date: "2026-12-25", hours: 7.5, rate: 12 }];
  state.holidaySettings = { "2026": { days: 28, rate: 12 } };
  assert.deepEqual(
    validateBackup(JSON.parse(JSON.stringify(state))).holidays,
    state.holidays,
  );
  assert.throws(() =>
    validateBackup({
      ...state,
      holidays: [...state.holidays, { ...state.holidays[0], id: "h2" }],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...state,
      holidaySettings: { "2026": { days: -1, rate: 12 } },
    }),
  );
  assert.deepEqual(holidayDates("2026-10-24", 3), [
    "2026-10-24",
    "2026-10-25",
    "2026-10-26",
  ]);
  assert.throws(() =>
    validateBackup({
      ...state,
      holidays: [{ ...state.holidays[0], date: "2026-02-30" }],
    }),
  );
  assert.deepEqual(
    validateBackup({ ...state, version: 5, holidays: undefined }).holidays,
    [],
  );
});
const weeklyPolicy = {
  rate: 10,
  overtimeMode: "multiplier" as const,
  overtime: 1.5,
  overtimeBase: "basic" as const,
  overtimeThreshold: "week" as const,
  weeklyHours: 40,
};
function weeklyEntry(
  date: string,
  start = "06:00",
  end = "18:00",
  overrides: Partial<Entry> = {},
) {
  return entry(date, start, end, {
    ...weeklyPolicy,
    id: `${date}-${start}`,
    shift: { ...defaultShifts()[0], workDate: date },
    ...overrides,
  });
}
test("overtime basis distinguishes Basic, multiplied allowance and the legacy unmultiplied allowance", () => {
  const policy = {
    rate: 10,
    overtime: 1.5,
    overtimeMode: "multiplier" as const,
    shiftAllowancePercent: 30,
  };
  assert.equal(
    extraHourlyRate({
      ...policy,
      overtimeBase: "basic",
      allowanceOnOvertime: true,
    }),
    15,
  );
  assert.equal(
    extraHourlyRate({
      ...policy,
      overtimeBase: "withAllowance",
      allowanceOnOvertime: true,
    }),
    19.5,
  );
  assert.equal(extraHourlyRate({ ...policy, allowanceOnOvertime: true }), 18);
  const example = { ...policy, rate: 17.8 };
  assert.ok(
    Math.abs(extraHourlyRate({ ...example, overtimeBase: "basic" }) - 26.7) <
      1e-9,
  );
  assert.ok(
    Math.abs(
      extraHourlyRate({ ...example, overtimeBase: "withAllowance" }) - 34.71,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      extraHourlyRate({ ...example, allowanceOnOvertime: true }) - 32.04,
    ) < 1e-9,
  );
});
test("weekly, shift and combined thresholds classify every minute once", () => {
  const dates = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"];
  const entries = dates.map((d) => weeklyEntry(d)); // four 12-hour shifts
  const weekly = totals(calculate(entries));
  assert.deepEqual(weekly, {
    minutes: 2880,
    regular: 2400,
    extra: 480,
    amount: 520,
  });
  const shift = totals(
    calculate(
      entries.map((e) => ({ ...e, overtimeThreshold: "shift" as const })),
    ),
  );
  assert.equal(shift.regular, 32 * 60);
  assert.equal(shift.extra, 16 * 60);
  const both = totals(
    calculate(
      entries.map((e) => ({ ...e, overtimeThreshold: "both" as const })),
    ),
  );
  assert.equal(both.regular, 28 * 60);
  assert.equal(both.extra, 20 * 60);
  assert.equal(both.regular + both.extra, both.minutes);
  assert.equal(both.amount, 580);
  assert.deepEqual(totals(calculate([...entries].reverse())), weekly);
});
test("fractional weekly targets are crossed mid-shift after excluding unpaid breaks", () => {
  const entries = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(
    (d) => weeklyEntry(d, "06:00", "14:00", { weeklyHours: 37.5 }),
  );
  const friday = weeklyEntry("2026-10-23", "06:00", "15:00", {
    weeklyHours: 37.5,
    breaks: [
      {
        start: stamp("2026-10-23", "10:00"),
        end: stamp("2026-10-23", "10:30"),
      },
    ],
  });
  const parts = calculate([...entries, friday]).filter(
    (s) => s.entry.id === friday.id,
  );
  assert.equal(totals(parts).minutes, 510);
  assert.equal(totals(parts).regular, 330);
  assert.equal(totals(parts).extra, 180);
  assert.equal(totals(parts).amount, 100);
});
test("a Sunday night splits weekly counters at Monday midnight without resetting its shift target", () => {
  const prior = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(
    (d) => weeklyEntry(d, "06:00", "15:00"),
  ); // 36 h
  const night = weeklyEntry("2026-10-25", "18:00", "23:00", {
    end: stamp("2026-10-26", "06:00"),
    shift: { ...defaultShifts()[1], workDate: "2026-10-25" },
    breaks: [
      {
        start: stamp("2026-10-25", "23:30"),
        end: stamp("2026-10-26", "00:30"),
      },
    ],
  });
  const parts = calculate([...prior, night]).filter(
    (s) => s.entry.id === night.id,
  );
  assert.equal(parts[0].regular, 240);
  assert.equal(parts[0].extra, 90);
  assert.equal(parts[1].regular, 330);
  assert.equal(parts[1].extra, 0);
  const both = calculate([
    ...prior,
    { ...night, overtimeThreshold: "both" },
  ]).filter((s) => s.entry.id === night.id);
  assert.equal(both[0].extra, 90);
  assert.equal(both[1].regular, 150);
  assert.equal(both[1].extra, 180);
});
test("weekly targets are independent by workplace and split sessions share both counters", () => {
  const prior = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(
    (d) => weeklyEntry(d, "06:00", "15:30", { overtimeThreshold: "both" }),
  ); // 38 paid hours
  const first = weeklyEntry("2026-10-23", "06:00", "10:00", {
    overtimeThreshold: "both",
  });
  const second = weeklyEntry("2026-10-23", "11:00", "17:00", {
    overtimeThreshold: "both",
  });
  const other = weeklyEntry("2026-10-23", "18:00", "22:00", { jobId: "other" });
  const slices = calculate([...prior, first, second, other]);
  const friday = totals(
    slices.filter((s) => [first.id, second.id].includes(s.entry.id)),
  );
  assert.equal(friday.regular, 120);
  assert.equal(friday.extra, 480);
  const separate = totals(slices.filter((s) => s.entry.jobId === "other"));
  assert.equal(separate.regular, 240);
  assert.equal(separate.extra, 0);
});
test("weekly basis and target snapshots survive later changes to the workplace policy", () => {
  const policy: Job = {
    ...job,
    ...weeklyPolicy,
    shiftAllowancePercent: 30,
    overtimeBase: "withAllowance",
    overtimeThreshold: "both",
    weeklyHours: 37.5,
  };
  const timer = makeTimer(
    policy,
    defaultShifts()[1],
    stamp("2026-10-20", "17:30"),
  );
  policy.rate = 100;
  policy.weeklyHours = 20;
  policy.overtimeBase = "basic";
  const e = finishTimer(timer, stamp("2026-10-21", "03:00"));
  assert.equal(e.weeklyHours, 37.5);
  assert.equal(e.overtimeBase, "withAllowance");
  assert.equal(e.overtimeThreshold, "both");
  assert.equal(extraHourlyRate(e), 19.5);
  const legacy = entry("2026-10-20", "06:00", "16:00", {
    rate: 17.8,
    shiftAllowancePercent: 30,
    allowanceOnOvertime: true,
    overtime: 1.5,
  });
  const old = { ...freshState(), version: 4, jobs: [job], entries: [legacy] };
  const next = validateBackup(old);
  assert.equal(next.version, 6);
  assert.deepEqual(next.entries, old.entries);
  assert.deepEqual(
    totals(calculate(next.entries)),
    totals(calculate(old.entries)),
  );
});
test("weekly exports retain earlier-week context when only the final entry is exported", () => {
  const state = freshState();
  state.jobs = [{ ...job, ...weeklyPolicy }];
  state.entries = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(
    (d) => weeklyEntry(d, "06:00", "16:00"),
  );
  const last = weeklyEntry("2026-10-23", "06:00", "11:00");
  state.entries.push(last);
  const output = csv(state, [last]);
  const lines = output
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .map((line) => line.split(";").map((value) => value.replace(/^"|"$/g, "")));
  assert.equal(lines.length, 2);
  assert.equal(lines[1][lines[0].indexOf("Nadgodziny")], "5.0000");
  assert.equal(lines[1][lines[0].indexOf("Kwota")], "75.00");
  assert.match(output, /Podstawa nadgodzin/);
  assert.match(output, /Norma tygodniowa/);
  assert.equal(totals(calculate(state.entries.slice(1))).extra, 0);
});
test("live weekly progress clips an overnight session and break to the current Monday week", () => {
  const timer = makeTimer(
    { ...job, ...weeklyPolicy },
    defaultShifts()[1],
    stamp("2026-10-25", "23:00"),
  );
  timer.breaks = [
    { start: stamp("2026-10-25", "23:30"), end: stamp("2026-10-26", "00:30") },
  ];
  assert.equal(timerWeekMinutes(timer, stamp("2026-10-26", "03:00")), 150);
  timer.pausedAt = stamp("2026-10-26", "02:00");
  assert.equal(timerWeekMinutes(timer, stamp("2026-10-26", "03:00")), 90);
});
test("weekly policy validation rejects missing targets and accepts hour-minute weekly inputs", () => {
  assert.equal(parseWeeklyNormHours("40:00"), 40);
  assert.equal(parseWeeklyNormHours("37:30"), 37.5);
  assert.equal(parseWeeklyNormHours("168:00"), 168);
  for (const value of ["00:00", "168:01", "40.5", "37:60"])
    assert.throws(() => parseWeeklyNormHours(value));
  const state = freshState();
  state.jobs = [
    {
      ...job,
      ...weeklyPolicy,
      overtimeBase: "withAllowance",
      shiftAllowancePercent: 30,
    },
  ];
  state.entries = [
    weeklyEntry("2026-10-19", "06:00", "18:00", {
      overtimeBase: "withAllowance",
      shiftAllowancePercent: 30,
    }),
  ];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
  const lines = csv(state)
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .map((line) => line.split(";").map((value) => value.replace(/^"|"$/g, "")));
  assert.equal(
    lines[1][lines[0].indexOf("Dodatek także za nadgodziny")],
    "Tak",
  );
  for (const policy of [
    { overtimeBase: "unknown" },
    { overtimeThreshold: "unknown" },
    { overtimeThreshold: "week" },
    { overtimeThreshold: "both", weeklyHours: 0 },
    { weeklyHours: Infinity },
    { weeklyHours: 169 },
  ]) {
    assert.throws(() =>
      validateBackup({ ...state, jobs: [{ ...job, ...policy }] }),
    );
  }
});
test("overtime accepts 150 percent and the 1.5 shortcut, and pays £15 on a £10 Basic", () => {
  for (const input of ["150", "150%", "1.5", "1,5"]) {
    const percent = overtimePercentInput(input);
    assert.equal(percent, 150);
    const e = entry("2026-10-20", "06:00", "16:00", {
      rate: 10,
      overtimeMode: "multiplier",
      overtime: percent / 100,
    });
    assert.equal(overtimeHourlyRate(e), 15);
    assert.equal(totals(calculate([e])).amount, 8 * 10 + 2 * 15);
  }
  for (const input of ["", "1.5%", "50", "0", "1001", "abc"])
    assert.throws(() => overtimePercentInput(input));
  assert.equal(
    policyOvertimePercent({
      ...job,
      rate: 10,
      overtimeMode: "fixed",
      overtimeRate: 15,
    }),
    150,
  );
  assert.equal(
    policyOvertimePercent({
      ...job,
      rate: 0,
      overtimeMode: "fixed",
      overtimeRate: 15,
    }),
    null,
  );
});
test("hours:minutes input removes decimal-hour ambiguity without changing saved norms", () => {
  assert.equal(parseNormHours("9:45"), 9.75);
  assert.equal(parseNormHours("09:27"), 9.45);
  assert.equal(parseNormHours("24:00"), 24);
  for (const input of ["9.45", "9,45", "00:00", "24:01", "8:75", "8"])
    assert.throws(() => parseNormHours(input));
});
test("selected shift, language and theme persist while an active timer keeps its original shift", () => {
  const state = freshState();
  state.language = "en";
  state.theme = "light";
  state.preferredShiftId = "night";
  state.jobs = [job];
  state.timer = makeTimer(job, state.shifts[1], Date.now());
  const next = validateBackup(
    JSON.parse(JSON.stringify({ ...state, preferredShiftId: "day" })),
  );
  assert.equal(next.timer?.shift?.id, "night");
  assert.equal(next.preferredShiftId, "day");
  assert.equal(next.language, "en");
  assert.equal(next.theme, "light");
  assert.throws(() => validateBackup({ ...state, language: "invalid" }));
  assert.throws(() => validateBackup({ ...state, theme: "invalid" }));
});
test("English interface localises actions, dynamic confirmations and decimal hours without changing unknown text", () => {
  assert.equal(translateText("Ustawienia", "en"), "Settings");
  assert.equal(translateText(" Norma ", "en"), " Target ");
  assert.equal(
    translateText("Basic — stawka podstawowa (GBP/h)", "en"),
    "Basic — hourly rate (GBP/h)",
  );
  assert.equal(
    translateText("Edytuj wpis Bowmill 2026-11-10", "en"),
    "Edit entry Bowmill 2026-11-10",
  );
  assert.equal(
    translateText("Zmienić walutę na GBP?", "en"),
    "Change currency to GBP?",
  );
  assert.equal(
    translateText("My own project #123", "en"),
    "My own project #123",
  );
  assert.equal(translateText("Ustawienia", "pl"), "Ustawienia");
  assert.equal(duration(225, "decimal", "en"), "3.75");
  assert.equal(duration(225, "decimal", "pl"), "3,75");
  const state = freshState();
  state.language = "en";
  state.jobs = [job];
  state.entries = [entry(undefined, undefined, undefined, { note: "Przerwa" })];
  assert.match(csv(state), /Workplace/);
  assert.match(csv(state), /"Przerwa"/);
});
test("all three palettes preserve text contrast and map colours including transparent borders", () => {
  function luminance(hex: string) {
    const channels = hex
      .match(/[a-f\d]{2}/gi)!
      .map((c) => parseInt(c, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  function contrast(a: string, b: string) {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  for (const [name, p] of Object.entries(themes)) {
    assert.ok(contrast(p.text, p.card) >= 4.5, name + " body text");
    assert.ok(contrast(p.muted, p.card) >= 4.5, name + " secondary text");
    assert.ok(contrast(p.bg, p.accent) >= 4.5, name + " primary button");
  }
  assert.equal(themeColor("#DCE2EA70", "light"), themes.light.accent + "70");
  assert.equal(themeColor("transparent", "light"), "transparent");
  assert.ok(
    contrast(themeColor("#BCB7AD", "light"), themes.light.raised) >= 4.5,
  );
});
test("time display switches formats without changing minute precision or stored earnings", () => {
  assert.equal(duration(225), "3:45");
  assert.equal(duration(225, "decimal"), "3,75");
  assert.equal(duration(4050, "decimal"), "67,50");
  assert.equal(duration(-10, "decimal"), "0,00");
  assert.equal(duration(1, "decimal"), "0,02");
  const state = freshState();
  state.jobs = [job];
  state.entries = [entry()];
  const before = totals(calculate(state.entries));
  const restored = validateBackup({
    ...state,
    timeFormat: "decimal",
    calendarMetric: "money",
  });
  assert.equal(restored.timeFormat, "decimal");
  assert.equal(restored.calendarMetric, "money");
  assert.deepEqual(totals(calculate(restored.entries)), before);
  assert.equal(validateBackup(state).timeFormat, undefined);
  assert.throws(() => validateBackup({ ...state, timeFormat: "invalid" }));
  assert.throws(() => validateBackup({ ...state, calendarMetric: "invalid" }));
});
test("percentage allowance applies to Basic up to the shift norm, then the separate overtime rate", () => {
  const e = entry("2026-10-20", "06:00", "16:00", {
    shiftAllowancePercent: 15,
    overtimeMode: "fixed",
    overtimeRate: 35,
  });
  assert.equal(allowanceHourlyRate(e), 3);
  assert.equal(totals(calculate([e])).amount, 8 * 23 + 2 * 35);
  assert.equal(
    totals(calculate([{ ...e, allowanceOnOvertime: true }])).amount,
    8 * 23 + 2 * 38,
  );
  assert.equal(
    totals(calculate([{ ...e, shiftAllowancePercent: 0 }])).amount,
    8 * 20 + 2 * 35,
  );
});
test("allowance respects unpaid breaks and one norm for an overnight shift", () => {
  const shift = defaultShifts()[1];
  const policy = {
    ...job,
    shiftAllowancePercent: 12.5,
    overtimeMode: "fixed" as const,
    overtimeRate: 35,
  };
  const t = makeTimer(policy, shift, stamp("2026-10-20", "17:30"));
  t.breaks = [
    { start: stamp("2026-10-20", "23:45"), end: stamp("2026-10-21", "00:15") },
  ];
  const e = finishTimer(t, stamp("2026-10-21", "03:00"));
  const parts = calculate([e]);
  assert.equal(parts.length, 2);
  assert.equal(totals(parts).minutes, 540);
  assert.equal(totals(parts).amount, 8 * 22.5 + 35);
  assert.equal(e.shiftAllowancePercent, 12.5);
  policy.shiftAllowancePercent = 80;
  assert.equal(totals(calculate([e])).amount, 215);
});
test("allowance policies survive backup and CSV, reject malformed values, and migrate version 3 without pay changes", () => {
  const state = freshState();
  state.jobs = [
    { ...job, shiftAllowancePercent: 15, allowanceOnOvertime: true },
  ];
  state.entries = [entry("2026-10-20", "06:00", "16:00", state.jobs[0])];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
  assert.match(csv(state), /Shift allowance \(%\)/);
  assert.match(csv(state), /Dodatek także za nadgodziny/);
  for (const invalid of [-1, Infinity, 1001, "15"]) {
    assert.throws(() =>
      validateBackup({
        ...state,
        jobs: [{ ...job, shiftAllowancePercent: invalid }],
      }),
    );
  }
  assert.throws(() =>
    validateBackup({
      ...state,
      jobs: [{ ...job, allowanceOnOvertime: "yes" }],
    }),
  );
  const previous = {
    ...freshState(),
    version: 3,
    jobs: [job],
    entries: [entry()],
  };
  assert.equal(validateBackup(previous).version, 6);
  assert.deepEqual(
    totals(calculate(validateBackup(previous).entries)),
    totals(calculate(previous.entries)),
  );
});
test("sample removal preserves real entries and an active timer, including work recorded under the demo job", () => {
  const state = demoState();
  assert.ok(state.entries.length > 0);
  const personal = entry("2026-01-10", "06:00", "14:00", {
    id: "personal",
    jobId: state.jobs[0].id,
  });
  state.entries.push(personal);
  state.timer = makeTimer(state.jobs[0], state.shifts[0], Date.now());
  const next = removeSampleData(state);
  assert.deepEqual(next.entries, [personal]);
  assert.equal(next.jobs.length, 1);
  assert.deepEqual(next.timer, state.timer);
  assert.equal(sampleEntryIds(next).size, 0);
  assert.ok(state.entries.length > 1);
});
test("legacy examples are recognized by their complete fingerprint, not the Bowmill name alone", () => {
  const state = demoState();
  state.jobs = state.jobs.map(({ demo: _demo, ...j }) => j);
  state.entries = state.entries.map(({ demo: _demo, ...e }) => e);
  assert.equal(sampleEntryIds(state).size, state.entries.length);
  const marked = markLegacySamples(state);
  assert.equal(
    marked.entries.every((e) => e.demo),
    true,
  );
  assert.equal(removeSampleData(marked).entries.length, 0);
  assert.equal(removeSampleData(marked).jobs.length, 0);
  state.entries[0].rate = 99;
  const retained = state.entries[0];
  assert.deepEqual(removeSampleData(state).entries, [retained]);
  const personal = {
    ...freshState(),
    jobs: [{ ...job, name: "Bowmill" }],
    entries: [entry()],
  };
  assert.equal(sampleEntryIds(personal).size, 0);
  assert.deepEqual(removeSampleData(personal).entries, personal.entries);
});
test("clearing work data preserves shift preferences, while project deletion affects only that project", () => {
  const state = freshState();
  state.currency = "PLN";
  state.timeFormat = "decimal";
  state.jobs = [job, { ...job, id: "other" }];
  state.entries = [
    entry(),
    entry("2026-10-21", "06:00", "14:00", {
      id: "other-entry",
      jobId: "other",
    }),
  ];
  const removed = removeJobData(state, "job");
  assert.equal(removed.entries.length, 1);
  assert.equal(removed.entries[0].jobId, "other");
  const cleared = clearWorkData(state);
  assert.equal(cleared.entries.length, 0);
  assert.equal(cleared.jobs.length, 0);
  assert.equal(cleared.currency, "PLN");
  assert.equal(cleared.timeFormat, "decimal");
  assert.deepEqual(cleared.shifts, state.shifts);
  state.timer = makeTimer(job, state.shifts[0], Date.now());
  assert.throws(() => clearWorkData(state), /zakończ/);
  assert.throws(() => removeJobData(state, job.id), /zakończ/);
});
test("a timer accidentally left running over a week can still be saved and restored", () => {
  const state = freshState();
  state.jobs = [job];
  state.entries = [
    finishTimer(
      {
        ...job,
        jobId: job.id,
        start: stamp("2026-10-01", "08:00"),
        breaks: [],
        pausedAt: null,
      },
      stamp("2026-10-10", "08:00"),
    ),
  ];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
  assert.equal(totals(calculate(state.entries)).minutes, 9 * 24 * 60);
});
function entry(
  date = "2026-10-20",
  start = "06:00",
  end = "16:00",
  overrides: Partial<Entry> = {},
): Entry {
  return {
    id: "entry",
    jobId: job.id,
    start: stamp(date, start),
    end: stamp(date, end),
    breaks: [],
    note: "",
    rate: job.rate,
    dailyHours: job.dailyHours,
    overtime: job.overtime,
    ...overrides,
  };
}
test("9.5 working hours with a half-hour break pays 8 regular and 1.5 overtime", () => {
  const e = entry();
  e.breaks = [{ start: e.start + 4 * 3600000, end: e.start + 4.5 * 3600000 }];
  assert.deepEqual(totals(calculate([e])), {
    minutes: 570,
    regular: 480,
    extra: 90,
    amount: 197.5,
  });
});
test("separate shifts on the same day share the overtime threshold", () => {
  const first = entry(undefined, "06:00", "12:00", { id: "a" }),
    second = entry(undefined, "13:00", "17:00", { id: "b" });
  assert.equal(totals(calculate([second, first])).amount, 210);
  assert.equal(calculate([second, first])[1].extra, 120);
});
test("different projects have separate daily allowances", () => {
  const a = entry(undefined, "06:00", "12:00"),
    b = entry(undefined, "13:00", "17:00", { id: "b", jobId: "other" });
  assert.equal(totals(calculate([a, b])).extra, 0);
});
test("overnight work and a break spanning midnight split correctly", () => {
  const e = entry("2026-10-20", "22:00", "23:00", {
    end: stamp("2026-10-21", "06:00"),
    breaks: [
      {
        start: stamp("2026-10-20", "23:45"),
        end: stamp("2026-10-21", "00:15"),
      },
    ],
  });
  const parts = calculate([e]);
  assert.equal(parts.length, 2);
  assert.deepEqual(
    parts.map((s) => [s.date, s.minutes]),
    [
      ["2026-10-20", 105],
      ["2026-10-21", 345],
    ],
  );
  assert.equal(totals(parts).amount, 150);
});
test("elapsed time uses actual time over the autumn DST transition", () => {
  const e = entry("2026-10-25", "00:00", "04:00");
  assert.equal(totals(calculate([e])).minutes, 300);
});
test("week grouping is Monday based, including year boundary", () => {
  assert.equal(weekKey(stamp("2027-01-03", "12:00")), "2026-12-28");
  assert.equal(weekKey(stamp("2027-01-04", "12:00")), "2027-01-04");
});
test("active and paused timers survive serialization and stop excludes pauses", () => {
  const start = stamp("2026-10-20", "06:00");
  const timer = {
    ...job,
    jobId: job.id,
    start,
    breaks: [{ start: start + 3600000, end: start + 5400000 }],
    pausedAt: start + 7200000,
  };
  assert.equal(
    timerMinutes(JSON.parse(JSON.stringify(timer)), start + 10800000),
    90,
  );
  const e = finishTimer(timer, start + 10800000);
  assert.equal(totals(calculate([e])).minutes, 90);
});
test("historical rate and multiplier remain independent of job settings", () => {
  const e = entry();
  const s = freshState();
  s.jobs = [{ ...job, rate: 100 }];
  s.entries = [e];
  assert.equal(totals(calculate(s.entries)).amount, 210);
});
test("rejects overlap, invalid time, impossible dates, and invalid breaks", () => {
  assert.throws(() => parseLocal("2026-02-30", "10:00"));
  assert.throws(() => parseLocal("2026-10-20", "25:00"));
  const e = entry();
  assert.throws(() => checkEntry({ ...e, id: "new" }, [e], null));
  assert.doesNotThrow(() => checkEntry(e, [e], null));
  assert.throws(() =>
    checkEntry(
      { ...e, breaks: [{ start: e.start - 1, end: e.end }] },
      [],
      null,
    ),
  );
  assert.throws(() =>
    checkEntry({ ...e, id: "b" }, [], {
      ...job,
      jobId: job.id,
      start: e.start,
      breaks: [],
      pausedAt: null,
    }),
  );
});
test("backup round trip and rejection of malformed or overlapping data", () => {
  const s = freshState();
  s.jobs = [job];
  s.entries = [entry()];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))), s);
  assert.throws(() => validateBackup({ ...s, version: 7 }));
  assert.throws(() =>
    validateBackup({
      ...s,
      entries: [entry(), entry(undefined, "10:00", "12:00", { id: "b" })],
    }),
  );
  assert.throws(() =>
    validateBackup({ ...s, jobs: [{ ...job, rate: Infinity }] }),
  );
  assert.throws(() =>
    validateBackup({ ...s, entries: [{ ...entry(), jobId: "missing" }] }),
  );
  assert.throws(() =>
    validateBackup({
      ...s,
      timer: { ...job, jobId: job.id, start: 1, breaks: [], pausedAt: null },
    }),
  );
});
test("CSV escapes quotes, formula injection and includes a BOM", () => {
  const s = freshState();
  s.jobs = [{ ...job, name: "=SUM(1,2)" }];
  s.entries = [
    entry(undefined, undefined, undefined, { note: 'test; "tekst"\nnowy' }),
  ];
  const output = csv(s);
  assert.ok(output.startsWith("\uFEFF"));
  assert.ok(output.includes('"\'=SUM(1,2)"'));
  assert.ok(output.includes('"test; ""tekst""\nnowy"'));
  assert.ok(output.includes('"GBP"'));
});
test("date keys use the local day, rather than UTC day", () => {
  assert.equal(dateKey(stamp("2026-07-01", "00:15")), "2026-07-01");
});
test("17:30–03:00 is one night shift with one 8-hour norm across midnight", () => {
  const night = defaultShifts()[1],
    start = stamp("2026-10-20", "17:30"),
    end = stamp("2026-10-21", "03:00");
  const timer = makeTimer(job, night, start),
    e = finishTimer(timer, end),
    t = totals(calculate([e]));
  assert.deepEqual(t, { minutes: 570, regular: 480, extra: 90, amount: 197.5 });
  assert.equal(e.shift?.workDate, "2026-10-20");
  assert.equal(calculate([e])[1].extra, 90);
});
test("night breaks reduce the working norm and allow fractional norms", () => {
  const shift = { ...defaultShifts()[1], normHours: 7.5 },
    start = stamp("2026-10-20", "17:30");
  const timer = makeTimer(job, shift, start);
  timer.breaks = [
    { start: stamp("2026-10-20", "23:45"), end: stamp("2026-10-21", "00:15") },
  ];
  const t = totals(
    calculate([finishTimer(timer, stamp("2026-10-21", "03:00"))]),
  );
  assert.equal(t.minutes, 540);
  assert.equal(t.regular, 450);
  assert.equal(t.extra, 90);
  assert.equal(t.amount, 187.5);
});
test("a new day or night occurrence gets a new norm, while split sessions share it", () => {
  const night = defaultShifts()[1];
  const a = finishTimer(
    makeTimer(job, night, stamp("2026-10-20", "17:30")),
    stamp("2026-10-20", "23:30"),
  );
  const b = finishTimer(
    makeTimer(job, night, stamp("2026-10-21", "00:00")),
    stamp("2026-10-21", "03:00"),
  );
  const c = finishTimer(
    makeTimer(job, night, stamp("2026-10-21", "17:30")),
    stamp("2026-10-21", "23:30"),
  );
  assert.equal(b.shift?.workDate, a.shift?.workDate);
  assert.notEqual(c.shift?.workDate, a.shift?.workDate);
  const t = totals(calculate([c, b, a]));
  assert.equal(t.regular, 840);
  assert.equal(t.extra, 60);
});
test("auto-stop caps elapsed time and persists exactly once after reopening", () => {
  const night = { ...defaultShifts()[1], autoStop: true };
  const start = stamp("2026-10-20", "17:30"),
    end = stamp("2026-10-21", "03:00");
  const timer = makeTimer(job, night, start);
  assert.equal(timer.plannedEnd, end);
  assert.equal(timerMinutes(timer, end + 8 * 3600000), 570);
  const state = freshState();
  state.jobs = [job];
  state.timer = timer;
  assert.equal(settleTimer(state, end - 1), state);
  const done = settleTimer(
    JSON.parse(JSON.stringify(state)),
    end + 8 * 3600000,
  );
  assert.equal(done.timer, null);
  assert.equal(done.entries.length, 1);
  assert.equal(done.entries[0].end, end);
  assert.equal(done.entries[0].autoStopped, true);
  assert.equal(settleTimer(done, end + 86400000), done);
  assert.equal(done.entries.length, 1);
});
test("automatic stop while paused clips the pause to the scheduled end", () => {
  const timer = makeTimer(
    job,
    { ...defaultShifts()[1], autoStop: true },
    stamp("2026-10-20", "17:30"),
  );
  timer.pausedAt = stamp("2026-10-21", "02:00");
  const e = finishTimer(timer, stamp("2026-10-21", "10:00"));
  assert.equal(e.end, stamp("2026-10-21", "03:00"));
  assert.equal(e.breaks[0].end, e.end);
  assert.equal(totals(calculate([e])).minutes, 510);
});
test("manual shifts stop only on request, and saved policies survive template edits", () => {
  const shift = defaultShifts()[1];
  const timer = makeTimer(job, shift, stamp("2026-10-20", "17:30"));
  shift.normHours = 6;
  shift.endTime = "01:00";
  assert.equal(timer.plannedEnd, undefined);
  assert.equal(timer.shift?.normHours, 8);
  assert.equal(timerMinutes(timer, stamp("2026-10-21", "04:00")), 630);
  assert.equal(
    finishTimer(timer, stamp("2026-10-21", "04:00")).autoStopped,
    undefined,
  );
});
test("starting after midnight belongs to the previous night and stops that morning", () => {
  const shift = { ...defaultShifts()[1], autoStop: true },
    at = stamp("2026-10-21", "00:30");
  assert.equal(shiftWorkDate(shift, at), "2026-10-20");
  assert.equal(shiftEnd(shift, at), stamp("2026-10-21", "03:00"));
});
test("only the part of an active night after midnight is counted as today", () => {
  const timer = makeTimer(
    job,
    defaultShifts()[1],
    stamp("2026-10-20", "17:30"),
  );
  assert.equal(
    timerDayMinutes(timer, stamp("2026-10-21", "02:00"), "2026-10-21"),
    120,
  );
  assert.equal(
    timerDayMinutes(timer, stamp("2026-10-21", "02:00"), "2026-10-20"),
    390,
  );
});
test("night auto-stop respects the local clock across DST and counts elapsed time", () => {
  const night = { ...defaultShifts()[1], autoStop: true };
  const timer = makeTimer(job, night, stamp("2026-10-24", "17:30"));
  assert.equal(timer.plannedEnd, stamp("2026-10-25", "03:00"));
  assert.equal(timerMinutes(timer, timer.plannedEnd!), 630);
  assert.equal(
    totals(calculate([finishTimer(timer, timer.plannedEnd!)])).extra,
    150,
  );
});
test("version 1 migrates without changing existing entries, pay, or running timer", () => {
  const previous = {
    version: 1,
    jobs: [job],
    entries: [entry()],
    timer: null,
    currency: "GBP",
    paidWeeks: [],
  };
  const next = validateBackup(previous);
  assert.equal(next.version, 6);
  assert.equal(next.shifts.length, 2);
  assert.deepEqual(next.entries, previous.entries);
  assert.equal(totals(calculate(next.entries)).amount, 210);
  const running = {
    ...previous,
    entries: [],
    timer: {
      jobId: job.id,
      start: stamp("2026-10-20", "06:00"),
      breaks: [],
      pausedAt: null,
      rate: 20,
      dailyHours: 8,
      overtime: 1.25,
    },
  };
  assert.deepEqual(validateBackup(running).timer, running.timer);
});
test("shift backup validates snapshots and rejects malformed hours, norms and deadlines", () => {
  const state = freshState();
  state.jobs = [job];
  state.timer = makeTimer(
    job,
    { ...state.shifts[1], autoStop: true },
    stamp("2026-10-20", "17:30"),
  );
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
  assert.throws(() => validateShift({ ...state.shifts[0], normHours: 0 }));
  assert.throws(() =>
    validateShift({ ...state.shifts[0], startTime: "25:00" }),
  );
  assert.throws(() => validateShift({ ...state.shifts[0], endTime: "06:00" }));
  assert.throws(() => validateBackup({ ...state, shifts: [] }));
  assert.throws(() =>
    validateBackup({ ...state, timer: { ...state.timer, plannedEnd: 0 } }),
  );
  assert.throws(() =>
    validateBackup({
      ...state,
      entries: [
        {
          ...entry(),
          shift: { ...state.shifts[0], normHours: -1, workDate: "2026-10-20" },
        },
      ],
      timer: null,
    }),
  );
});

test("fixed overtime pays its hourly amount independently of the base-rate multiplier", () => {
  const e = entry(undefined, "06:00", "16:00", {
    overtimeMode: "fixed",
    overtimeRate: 37,
    breaks: [
      {
        start: stamp("2026-10-20", "12:00"),
        end: stamp("2026-10-20", "12:30"),
      },
    ],
  });
  assert.equal(totals(calculate([e])).amount, 215.5);
  assert.equal(overtimeHourlyRate(e), 37);
  assert.equal(
    totals(calculate([{ ...e, overtimeMode: "multiplier", overtime: 2 }]))
      .amount,
    220,
  );
  assert.equal(totals(calculate([{ ...e, overtimeRate: 0 }])).amount, 160);
});
test("fixed overtime snapshots persist through a live timer and later project changes", () => {
  const employer = { ...job, overtimeMode: "fixed" as const, overtimeRate: 35 };
  const timer = makeTimer(
    employer,
    defaultShifts()[1],
    stamp("2026-10-20", "17:30"),
  );
  employer.overtimeRate = 45;
  employer.rate = 30;
  const e = finishTimer(timer, stamp("2026-10-21", "03:00"));
  assert.equal(e.overtimeRate, 35);
  assert.equal(e.rate, 20);
  assert.equal(totals(calculate([e])).amount, 212.5);
  const state = freshState();
  state.jobs = [employer];
  state.entries = [e];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
});
test("invalid fixed rates and unknown modes are rejected without changing legacy entries", () => {
  const state = freshState();
  state.jobs = [job];
  state.entries = [entry()];
  const baseline = totals(calculate(state.entries));
  for (const policy of [
    { overtimeMode: "fixed" },
    { overtimeMode: "fixed", overtimeRate: -1 },
    { overtimeMode: "fixed", overtimeRate: Infinity },
    { overtimeMode: "unknown", overtimeRate: 30 },
  ])
    assert.throws(() =>
      validateBackup({ ...state, jobs: [{ ...job, ...policy }] }),
    );
  assert.deepEqual(totals(calculate(validateBackup(state).entries)), baseline);
  assert.throws(() =>
    validateBackup({
      ...state,
      entries: [{ ...entry(), overtimeMode: "fixed", overtimeRate: -5 }],
    }),
  );
});
test("CSV exports the effective overtime rate and leaves the multiplier blank for fixed pay", () => {
  const state = freshState();
  state.jobs = [job];
  state.entries = [
    entry(undefined, "06:00", "16:00", {
      overtimeMode: "fixed",
      overtimeRate: 35,
    }),
  ];
  const output = csv(state);
  assert.ok(output.includes('"Stawka nadgodzin za godzinę"'));
  assert.ok(output.includes('"";"Stawka godzinowa";"35.00"'));
});
test("calendar grids start on Monday, include leap day and contain no adjacent-month duplicates", () => {
  const november = calendarDays("2026-11");
  assert.equal(november.length, 42);
  assert.equal(november[6], "2026-11-01");
  assert.equal(november.filter(Boolean).length, 30);
  const february = calendarDays("2028-02");
  assert.equal(february.filter(Boolean).length, 29);
  assert.ok(february.includes("2028-02-29"));
  const march = calendarDays("2026-03");
  assert.equal(new Set(march.filter(Boolean)).size, 31);
  assert.equal(moveMonth("2026-12", 1), "2027-01");
  assert.equal(moveMonth("2026-01", -1), "2025-12");
});
test("version 2 backups migrate unchanged to version 6 so old readers reject new policies", () => {
  const legacy = {
    ...freshState(),
    version: 2,
    jobs: [job],
    entries: [entry()],
  };
  const migrated = validateBackup(legacy);
  assert.equal(migrated.version, 6);
  assert.deepEqual(migrated.entries, legacy.entries);
  assert.deepEqual(migrated.shifts, legacy.shifts);
  assert.equal(totals(calculate(migrated.entries)).amount, 210);
});
