import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  groupSlices,
  normalizeWeeklyOvertime,
  setWeeklyBalance,
  parseWeeklyBalance,
  weeklyCorrectionMinutes,
  formatCountdown,
  previewSlices,
  updateActiveWeeklyPolicy,
  setWeeklyTarget,
  priorShiftBreakMilliseconds,
  syncTimerBreakContext,
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
  findEntryConflicts,
  csv,
  dateKey,
  localDate,
  finishTimer,
  finishShift,
  finishShiftAt,
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
import { dashboardWeek } from "../src/dashboardWeek";
import {
  manualDates,
  moveManualDay,
  previousLocalDay,
} from "../src/manualEntry";
import {
  languageFromLocale,
  resolveLanguage,
  setDeviceLanguage,
  translateText,
} from "../src/i18n";
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
test("overnight reporting can use the shift start date without losing pay or breaks", () => {
  const night = {
    ...entry("2026-11-17", "17:30", "23:30"),
    end: stamp("2026-11-18", "03:00"),
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
    breaks: [
      {
        start: stamp("2026-11-18", "02:30"),
        end: stamp("2026-11-18", "03:00"),
      },
    ],
  };
  const actual = calculate([night]);
  const byStart = groupSlices(actual, "shift");
  assert.deepEqual(
    byStart.map((part) => part.date),
    ["2026-11-17", "2026-11-17"],
  );
  assert.deepEqual(
    groupSlices(actual, "midnight").map((part) => part.date),
    ["2026-11-17", "2026-11-18"],
  );
  assert.deepEqual(totals(byStart), totals(actual));
  assert.equal(totals(byStart).minutes, 9 * 60);
  const state = {
    ...freshState(),
    jobs: [job],
    entries: [night],
    countingMode: "shift" as const,
  };
  assert.equal(
    validateBackup(JSON.parse(JSON.stringify(state))).countingMode,
    "shift",
  );
  assert.throws(() => validateBackup({ ...state, countingMode: "invalid" }));
  assert.match(csv(state), /"2026-11-17"/);
  assert.doesNotMatch(csv(state), /"2026-11-18"/);
});
test("legacy entries use the workplace weekly target and preserve historical rates and breaks", () => {
  const currentJob = {
    ...job,
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
    shiftAllowancePercent: 30,
  };
  const night = {
    ...entry("2026-11-16", "17:30", "23:30"),
    end: stamp("2026-11-17", "03:53"),
    rate: 18,
    shiftAllowancePercent: 30,
    overtime: 1.5,
    overtimeThreshold: "shift" as const,
    shift: { ...defaultShifts()[1], workDate: "2026-11-16", normHours: 9.75 },
    breaks: [],
  };
  const next = {
    ...night,
    id: "next",
    start: stamp("2026-11-17", "17:30"),
    end: stamp("2026-11-18", "03:15"),
    shift: { ...night.shift, workDate: "2026-11-17" },
  };
  const base = {
    ...freshState(),
    jobs: [currentJob],
    entries: [night, next],
    paidWeeks: ["2026-11-16"],
  };
  assert.equal(totals(calculate(base.entries)).extra, 38);
  const fixed = normalizeWeeklyOvertime(base);
  assert.equal(fixed.weeklyCorrectionNotice, true);
  assert.equal(totals(calculate(fixed.entries)).minutes, 20 * 60 + 8);
  assert.equal(totals(calculate(fixed.entries)).extra, 0);
  assert.equal(fixed.entries[0].weeklyHours, 39);
  assert.equal(fixed.entries[0].rate, night.rate);
  assert.equal(
    fixed.entries[0].shiftAllowancePercent,
    night.shiftAllowancePercent,
  );
  assert.deepEqual(fixed.entries[0].breaks, night.breaks);
  assert.deepEqual(fixed.paidWeeks, base.paidWeeks);
  assert.equal(normalizeWeeklyOvertime(fixed), fixed);
  assert.equal(
    validateBackup(JSON.parse(JSON.stringify(fixed))).weeklyCorrectionNotice,
    true,
  );
  const extra = weeklyEntry("2026-11-18", "05:00", "23:00", {
    weeklyHours: 39,
  });
  const end = weeklyEntry("2026-11-19", "06:00", "10:00", { weeklyHours: 39 });
  const result = totals(calculate([...fixed.entries, extra, end]));
  assert.equal(result.extra, 3 * 60 + 8);
});
test("dashboard lists each payroll slice once even when a night crosses weeks", () => {
  const overnight = {
    ...entry("2026-10-25", "17:30", "23:30"),
    end: stamp("2026-10-26", "03:00"),
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
    shift: { ...defaultShifts()[1], workDate: "2026-10-25" },
  };
  const parts = groupSlices(calculate([overnight], "midnight"), "shift");
  const previous = dashboardWeek(parts, "2026-10-19", job.id);
  const next = dashboardWeek(parts, "2026-10-26", job.id);
  assert.equal(previous.total.minutes, 390);
  assert.equal(next.total.minutes, 180);
  assert.equal(previous.days[6].total.minutes, 390);
  assert.equal(next.days[0].total.minutes, 180);
  assert.equal(
    previous.days.reduce((sum, day) => sum + day.total.minutes, 0),
    previous.total.minutes,
  );
  assert.equal(
    next.days.reduce((sum, day) => sum + day.total.minutes, 0),
    next.total.minutes,
  );
  assert.equal(dashboardWeek(parts, "2026-10-19", "other").total.minutes, 0);
});
test("corrected shift end preserves breaks and rejects future or lost break time", () => {
  const state = freshState();
  state.jobs = [job];
  const shift = defaultShifts()[1];
  const start = stamp("2026-10-20", "17:30");
  const timer = {
    ...makeTimer(job, shift, start),
    breaks: [
      {
        start: stamp("2026-10-20", "23:00"),
        end: stamp("2026-10-20", "23:30"),
      },
    ],
  };
  state.timer = timer;
  const end = stamp("2026-10-21", "03:00"),
    now = stamp("2026-10-21", "04:00");
  const result = finishShiftAt(state, timer, end, now);
  assert.equal(result.timer, null);
  assert.equal(result.entries[0].end, end);
  assert.deepEqual(result.entries[0].breaks, timer.breaks);
  assert.equal(totals(calculate(result.entries)).minutes, 540);
  assert.equal(state.timer, timer);
  assert.throws(
    () => finishShiftAt(state, timer, now + 60000, now),
    /przyszłości/,
  );
  assert.throws(
    () => finishShiftAt(state, timer, start, now),
    /po rozpoczęciu/,
  );
  assert.throws(
    () => finishShiftAt(state, timer, stamp("2026-10-20", "23:15"), now),
    /przerwą/,
  );
});
test("overlap details identify overnight entries, the active clock and allow adjacent work", () => {
  const saved = {
    ...entry("2026-11-16", "18:00", "23:30"),
    end: stamp("2026-11-17", "03:45"),
    id: "saved",
  };
  const duplicate = { ...saved, id: "new", end: stamp("2026-11-17", "03:00") };
  const found = findEntryConflicts(duplicate, [saved], null);
  assert.deepEqual(
    found.entries.map((e) => e.id),
    ["saved"],
  );
  assert.equal(found.activeTimer, false);
  assert.throws(() => checkEntry(duplicate, [saved], null), /nakłada/);
  assert.deepEqual(findEntryConflicts(saved, [saved], null).entries, []);
  const adjacent = {
    ...duplicate,
    start: saved.end,
    end: stamp("2026-11-17", "05:00"),
  };
  assert.deepEqual(findEntryConflicts(adjacent, [saved], null).entries, []);
  const timer = makeTimer(
    job,
    defaultShifts()[1],
    stamp("2026-11-17", "04:00"),
  );
  assert.equal(findEntryConflicts(adjacent, [saved], timer).activeTimer, true);
  assert.equal(
    findEntryConflicts({ ...adjacent, end: timer.start }, [saved], timer)
      .activeTimer,
    false,
  );
});
test("weekly balance correction leaves past earnings intact and affects future overtime", () => {
  assert.equal(parseWeeklyBalance("29:28"), 29 * 60 + 28);
  assert.equal(parseWeeklyBalance("0:00"), 0);
  for (const invalid of ["29.28", "29:60", "-1:00", "337:00"])
    assert.throws(() => parseWeeklyBalance(invalid));
  const j = {
    ...job,
    rate: 20,
    overtime: 1.5,
    overtimeMode: "multiplier" as const,
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
  };
  const entries = ["2026-11-16", "2026-11-17", "2026-11-18"].map((date, i) => ({
    ...entry(date, "06:00", "16:00"),
    ...j,
    id: `old${i}`,
    jobId: j.id,
  }));
  const state = { ...freshState(), jobs: [j], entries };
  const before = totals(calculate(entries));
  const adjusted = setWeeklyBalance(
    state,
    j.id,
    "2026-11-16",
    29 * 60 + 28,
    stamp("2026-11-19", "04:00"),
  );
  assert.equal(adjusted.balanceCorrections.length, 1);
  assert.equal(
    weeklyCorrectionMinutes(adjusted.balanceCorrections, j.id, "2026-11-16"),
    -32,
  );
  assert.deepEqual(
    totals(calculate(entries, "midnight", adjusted.balanceCorrections)),
    before,
  );
  assert.deepEqual(adjusted.entries, state.entries);
  const future = {
    ...entry("2026-11-19", "06:00", "16:00"),
    ...j,
    id: "new",
    jobId: j.id,
  };
  const after = calculate(
    [...entries, future],
    "midnight",
    adjusted.balanceCorrections,
  );
  assert.equal(
    totals(after.filter((part) => part.entry.id === "new")).extra,
    28,
  );
  assert.deepEqual(
    totals(after.filter((part) => part.entry.id !== "new")),
    before,
  );
  const backup = validateBackup(JSON.parse(JSON.stringify(adjusted)));
  assert.deepEqual(backup.balanceCorrections, adjusted.balanceCorrections);
  assert.throws(() =>
    validateBackup({
      ...backup,
      balanceCorrections: [
        { ...backup.balanceCorrections[0], deltaMinutes: Infinity },
      ],
    }),
  );
  assert.throws(
    () =>
      setWeeklyBalance(
        {
          ...state,
          timer: makeTimer(j, state.shifts[0], stamp("2026-11-19", "04:00")),
        },
        j.id,
        "2026-11-16",
        0,
        stamp("2026-11-19", "05:00"),
      ),
    /Najpierw zakończ/,
  );
});
test("positive and repeated corrections preserve existing pay and affect only later work", () => {
  const j = {
    ...job,
    rate: 20,
    overtime: 1.5,
    overtimeMode: "multiplier" as const,
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
  };
  const first = {
    ...entry("2026-11-16", "06:00", "16:00"),
    ...j,
    id: "first",
    jobId: j.id,
  };
  const state = { ...freshState(), jobs: [j], entries: [first] };
  const firstPay = totals(calculate(state.entries)).amount;
  const corrected = setWeeklyBalance(
    state,
    j.id,
    "2026-11-16",
    35 * 60,
    stamp("2026-11-17", "04:00"),
  );
  assert.equal(
    weeklyCorrectionMinutes(corrected.balanceCorrections, j.id, "2026-11-16"),
    25 * 60,
  );
  const next = {
    ...entry("2026-11-17", "06:00", "14:00"),
    ...j,
    id: "second",
    jobId: j.id,
  };
  const intermediate = { ...corrected, entries: [...corrected.entries, next] };
  const afterFirst = calculate(
    intermediate.entries,
    "midnight",
    intermediate.balanceCorrections,
  );
  assert.equal(
    totals(afterFirst.filter((x) => x.entry.id === "first")).amount,
    firstPay,
  );
  assert.equal(
    totals(afterFirst.filter((x) => x.entry.id === "second")).extra,
    4 * 60,
  );
  const secondPay = totals(
    afterFirst.filter((x) => x.entry.id === "second"),
  ).amount;
  const correctedAgain = setWeeklyBalance(
    intermediate,
    j.id,
    "2026-11-16",
    38 * 60,
    stamp("2026-11-18", "04:00"),
  );
  assert.equal(correctedAgain.balanceCorrections.length, 2);
  const afterSecond = calculate(
    intermediate.entries,
    "midnight",
    correctedAgain.balanceCorrections,
  );
  assert.equal(
    totals(afterSecond.filter((x) => x.entry.id === "second")).amount,
    secondPay,
  );
  const last = {
    ...entry("2026-11-18", "06:00", "08:00"),
    ...j,
    id: "third",
    jobId: j.id,
  };
  assert.equal(
    totals(
      calculate(
        [...intermediate.entries, last],
        "midnight",
        correctedAgain.balanceCorrections,
      ).filter((x) => x.entry.id === "third"),
    ).extra,
    60,
  );
  const nextWeek = {
    ...entry("2026-11-23", "06:00", "08:00"),
    ...j,
    id: "next-week",
    jobId: j.id,
  };
  assert.equal(
    totals(
      calculate(
        [...intermediate.entries, nextWeek],
        "midnight",
        correctedAgain.balanceCorrections,
      ).filter((x) => x.entry.id === "next-week"),
    ).extra,
    0,
  );
});
test("week-boundary options apply an adjustment to the intended week only", () => {
  const j = {
    ...job,
    overtime: 1.5,
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
  };
  const state = { ...freshState(), jobs: [j] };
  const corrected = setWeeklyBalance(
    state,
    j.id,
    "2026-11-09",
    38 * 60,
    stamp("2026-11-15", "17:00"),
  );
  const night = {
    ...entry("2026-11-15", "18:00", "23:30"),
    ...j,
    id: "sunday-night",
    jobId: j.id,
    end: stamp("2026-11-16", "02:00"),
    breaks: [],
  };
  const split = totals(
    calculate([night], "midnight", corrected.balanceCorrections),
  );
  const startingWeek = totals(
    calculate([night], "shift", corrected.balanceCorrections),
  );
  assert.equal(split.extra, 5 * 60);
  assert.equal(startingWeek.extra, 7 * 60);
  assert.equal(split.minutes, 8 * 60);
  assert.equal(startingWeek.minutes, split.minutes);
  const other = { ...night, id: "other", jobId: "other" };
  assert.equal(
    totals(calculate([other], "shift", corrected.balanceCorrections)).extra,
    0,
  );
});
test("a correction splits a later-entered shift at the exact correction time", () => {
  const j = {
    ...job,
    overtime: 1.5,
    overtimeThreshold: "week" as const,
    weeklyHours: 39,
  };
  const state = { ...freshState(), jobs: [j] };
  const corrected = setWeeklyBalance(
    state,
    j.id,
    "2026-11-16",
    38 * 60,
    stamp("2026-11-18", "12:00"),
  );
  const work = {
    ...entry("2026-11-18", "11:00", "13:00"),
    ...j,
    id: "crosses-correction",
    jobId: j.id,
    breaks: [],
  };
  const pieces = calculate([work], "midnight", corrected.balanceCorrections);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].regular, 60);
  assert.equal(pieces[0].extra, 0);
  assert.equal(pieces[1].regular, 0);
  assert.equal(pieces[1].extra, 60);
});
test("removing examples preserves a user's separate balance correction", () => {
  const sample = demoState();
  const jobId = sample.jobs[0].id;
  const correction = {
    id: "user-correction",
    jobId,
    week: weekKey(Date.now()),
    asOf: Date.now(),
    deltaMinutes: 60,
  };
  const adjusted = { ...sample, balanceCorrections: [correction] };
  const result = removeSampleData(adjusted);
  assert.ok(result.jobs.some((j) => j.id === jobId));
  assert.deepEqual(result.balanceCorrections, [correction]);
  assert.doesNotThrow(() => validateBackup(JSON.parse(JSON.stringify(result))));
});
test("adjustment backups migrate safely and exports never invent paid shifts", () => {
  const j = { ...job, overtimeThreshold: "week" as const, weeklyHours: 39 };
  const state = {
    ...freshState(),
    jobs: [j],
    entries: [{ ...entry(), jobId: j.id }],
  };
  const legacy = { ...state, version: 7 };
  const { balanceCorrections: _ignored, ...oldBackup } = legacy;
  const migrated = validateBackup(JSON.parse(JSON.stringify(oldBackup)));
  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.balanceCorrections, []);
  assert.deepEqual(migrated.entries, state.entries);
  const corrected = setWeeklyBalance(
    state,
    j.id,
    "2026-10-19",
    29 * 60 + 28,
    stamp("2026-11-19", "04:00"),
  );
  const exported = csv(corrected);
  assert.match(exported, /Korekta salda bez wynagrodzenia/);
  assert.match(exported, /"0\.00"/);
  assert.throws(() =>
    validateBackup({ ...corrected, balanceCorrections: [null] }),
  );
  assert.throws(() =>
    validateBackup({
      ...corrected,
      balanceCorrections: [
        corrected.balanceCorrections[0],
        corrected.balanceCorrections[0],
      ],
    }),
  );
  const cleaned = clearWorkData(corrected);
  assert.deepEqual(cleaned.balanceCorrections, []);
  const removed = removeJobData(corrected, j.id);
  assert.deepEqual(removed.balanceCorrections, []);
});
test("countdown shows remaining seconds without reaching zero early", () => {
  assert.equal(formatCountdown(11 + 35 / 60), "00:11:35");
  assert.equal(formatCountdown(0.001), "00:00:01");
  assert.equal(formatCountdown(-2), "00:00:00");
  assert.equal(formatCountdown(37.5 * 60), "37:30:00");
});
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
test("live dashboard includes the active shift in weekly totals and estimated overtime", () => {
  const prior = [
    weeklyEntry("2026-11-16"),
    weeklyEntry("2026-11-17"),
    weeklyEntry("2026-11-18"),
    weeklyEntry("2026-11-19", "06:00", "09:00"),
  ];
  const activeJob = { ...job, ...weeklyPolicy };
  const timer = makeTimer(
    activeJob,
    defaultShifts()[0],
    stamp("2026-11-20", "06:00"),
  );
  const before = JSON.stringify(timer);
  const live = previewSlices(prior, timer, stamp("2026-11-20", "08:00"));
  const total = totals(live);
  assert.equal(total.minutes, 41 * 60);
  assert.equal(total.extra, 60);
  assert.equal(total.amount, 415);
  assert.equal(
    totals(live.filter((slice) => slice.date === "2026-11-20")).amount,
    25,
  );
  assert.equal(JSON.stringify(timer), before);
  const paused = { ...timer, pausedAt: stamp("2026-11-20", "07:00") };
  assert.equal(
    totals(previewSlices(prior, paused, stamp("2026-11-20", "08:00"))).minutes,
    40 * 60,
  );
});
test("changing weekly settings updates only the matching running timer's weekly policy", () => {
  const original = makeTimer(
    { ...job, ...weeklyPolicy },
    defaultShifts()[0],
    stamp("2026-11-20", "06:00"),
  );
  const changed = updateActiveWeeklyPolicy(original, {
    ...job,
    ...weeklyPolicy,
    weeklyHours: 37.5,
    rate: 99,
    overtime: 2,
  });
  assert.equal(changed?.weeklyHours, 37.5);
  assert.equal(changed?.rate, original.rate);
  assert.equal(changed?.overtime, original.overtime);
  assert.equal(original.weeklyHours, 40);
  assert.equal(
    updateActiveWeeklyPolicy(original, {
      ...job,
      id: "other",
      ...weeklyPolicy,
    }),
    original,
  );
});
test("updating the weekly target changes the active shift's overtime preview immediately", () => {
  const prior = [
    weeklyEntry("2026-11-16"),
    weeklyEntry("2026-11-17"),
    weeklyEntry("2026-11-18"),
    weeklyEntry("2026-11-19", "06:00", "09:00"),
  ];
  const original = makeTimer(
    { ...job, ...weeklyPolicy },
    defaultShifts()[0],
    stamp("2026-11-20", "06:00"),
  );
  const changed = updateActiveWeeklyPolicy(original, {
    ...job,
    ...weeklyPolicy,
    weeklyHours: 41,
  });
  const now = stamp("2026-11-20", "08:00");
  assert.equal(totals(previewSlices(prior, original, now)).extra, 60);
  assert.equal(totals(previewSlices(prior, changed, now)).extra, 0);
  assert.equal(prior[0].weeklyHours, 40);
});
test("weekly-only target begins overtime after 39 hours and optionally corrects past entries", () => {
  const state = freshState();
  state.jobs = [{ ...job, overtimeThreshold: "both", weeklyHours: 39 }];
  state.entries = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map(
    (d) =>
      weeklyEntry(d, "06:00", "16:00", {
        overtimeThreshold: "both",
        weeklyHours: 39,
      }),
  );
  const preserved = setWeeklyTarget(state, job.id, 39, false);
  assert.equal(preserved.jobs[0].overtimeThreshold, "week");
  assert.deepEqual(preserved.entries, state.entries);
  const corrected = setWeeklyTarget(state, job.id, 39, true);
  assert.equal(totals(calculate(corrected.entries)).minutes, 40 * 60);
  assert.equal(totals(calculate(corrected.entries)).extra, 60);
  assert.equal(corrected.entries[0].rate, state.entries[0].rate);
  assert.deepEqual(corrected.entries[0].breaks, state.entries[0].breaks);
  assert.equal(state.entries[0].overtimeThreshold, "both");
});
test("automatic break fills only the missing recorded minutes after a shift", () => {
  const shift = defaultShifts()[0],
    start = stamp("2026-10-20", "06:00"),
    end = stamp("2026-10-20", "14:00");
  const timer = makeTimer({ ...job, ...weeklyPolicy }, shift, start, 30);
  const noManual = finishTimer(timer, end, "auto");
  assert.equal(noManual.breaks.length, 1);
  assert.equal(noManual.breaks[0].start, end - 30 * 60000);
  assert.equal(totals(calculate([noManual])).minutes, 450);
  const withTen = {
    ...timer,
    breaks: [
      { start: start + 3 * 3600000, end: start + 3 * 3600000 + 10 * 60000 },
    ],
  };
  const finishedTen = finishTimer(withTen, end, "partial");
  assert.equal(totals(calculate([finishedTen])).minutes, 450);
  assert.equal(
    finishedTen.breaks.reduce((sum, b) => sum + b.end - b.start, 0),
    30 * 60000,
  );
  const withForty = {
    ...timer,
    breaks: [
      { start: start + 3 * 3600000, end: start + 3 * 3600000 + 40 * 60000 },
    ],
  };
  assert.equal(
    totals(calculate([finishTimer(withForty, end, "long")])).minutes,
    440,
  );
  assert.equal(
    totals(calculate([finishTimer(timer, start + 10 * 60000, "short")]))
      .minutes,
    0,
  );
  assert.equal(totals(previewSlices([], timer, end)).minutes, 480);
});
test("automatic break at midnight is attributed to the end of the shift", () => {
  const start = stamp("2026-11-22", "23:40"),
    end = stamp("2026-11-23", "00:20");
  const timer = makeTimer(
    { ...job, ...weeklyPolicy },
    defaultShifts()[1],
    start,
    30,
  );
  const slices = calculate([finishTimer(timer, end, "boundary")]);
  assert.equal(
    totals(slices.filter((slice) => slice.date === "2026-11-22")).minutes,
    10,
  );
  assert.equal(
    totals(slices.filter((slice) => slice.date === "2026-11-23")).minutes,
    0,
  );
});
test("migration applies weekly overtime to current jobs and running timer while retaining history and holiday", () => {
  const state = freshState();
  state.jobs = [{ ...job, overtimeThreshold: "both", weeklyHours: 39 }];
  state.entries = [
    weeklyEntry("2026-10-19", "06:00", "16:00", {
      overtimeThreshold: "both",
      weeklyHours: 39,
    }),
  ];
  state.timer = makeTimer(
    state.jobs[0],
    defaultShifts()[1],
    stamp("2026-10-20", "17:30"),
  );
  state.holidays = [{ id: "h1", date: "2026-12-25", hours: 8, rate: 12 }];
  state.holidaySettings = { "2026": { days: 28, rate: 12 } };
  const migrated = validateBackup({ ...state, version: 6 });
  assert.equal(migrated.version, 8);
  assert.equal(migrated.jobs[0].overtimeThreshold, "week");
  assert.equal(migrated.timer?.overtimeThreshold, "week");
  assert.equal(migrated.timer?.weeklyHours, 39);
  assert.equal(migrated.timer?.rate, state.timer.rate);
  assert.deepEqual(migrated.entries, state.entries);
  assert.deepEqual(migrated.holidays, state.holidays);
  assert.deepEqual(migrated.holidaySettings, state.holidaySettings);
  assert.equal(migrated.defaultBreakMinutes, 0);
  assert.equal(migrated.automaticBreak, false);
});
test("automatic break setting is saved with running timers, bounded and preserved in backups", () => {
  const state = freshState();
  state.jobs = [{ ...job, ...weeklyPolicy }];
  state.defaultBreakMinutes = 30;
  state.automaticBreak = true;
  state.timer = makeTimer(
    state.jobs[0],
    defaultShifts()[0],
    stamp("2026-10-20", "06:00"),
    state.defaultBreakMinutes,
  );
  const restored = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.timer?.autoBreakMinutes, 30);
  assert.equal(restored.automaticBreak, true);
  assert.throws(() => validateBackup({ ...state, defaultBreakMinutes: -1 }));
  assert.throws(() =>
    validateBackup({
      ...state,
      timer: { ...state.timer, autoBreakMinutes: 2000 },
    }),
  );
});
test("automatic break is applied once across split sessions of the same shift", () => {
  const shift = defaultShifts()[0],
    j = { ...job, ...weeklyPolicy };
  const first = makeTimer(j, shift, stamp("2026-10-20", "06:00"), 30);
  const saved = finishTimer(first, stamp("2026-10-20", "10:00"), "first");
  const prior = priorShiftBreakMilliseconds(
    [saved],
    j.id,
    shift,
    stamp("2026-10-20", "10:00"),
    30,
  );
  assert.equal(prior, 30 * 60000);
  const second = makeTimer(j, shift, stamp("2026-10-20", "10:00"), 30, prior);
  const done = finishTimer(second, stamp("2026-10-20", "14:00"), "second");
  assert.equal(done.breaks.length, 0);
  assert.equal(totals(calculate([saved, done])).minutes, 450);
  const state = freshState();
  state.jobs = [j];
  state.entries = [{ ...saved, breaks: [] }];
  state.timer = second;
  const synchronized = syncTimerBreakContext(state);
  assert.equal(synchronized.timer?.priorBreakMilliseconds, 0);
  assert.equal(
    finishTimer(synchronized.timer!, stamp("2026-10-20", "14:00"), "changed")
      .breaks.length,
    1,
  );
});
test("later manual breaks replace only synthetic breaks in the same split shift", () => {
  const shift = defaultShifts()[0],
    j = { ...job, ...weeklyPolicy };
  const state = freshState();
  state.jobs = [j];
  const first = makeTimer(j, shift, stamp("2026-10-20", "06:00"), 30);
  const afterFirst = finishShift(
    { ...state, timer: first },
    first,
    stamp("2026-10-20", "10:00"),
  );
  assert.equal(afterFirst.entries[0].automaticBreaks?.length, 1);
  const prior = priorShiftBreakMilliseconds(
    afterFirst.entries,
    j.id,
    shift,
    stamp("2026-10-20", "10:00"),
    30,
  );
  const second = {
    ...makeTimer(j, shift, stamp("2026-10-20", "10:00"), 30, prior),
    breaks: [
      {
        start: stamp("2026-10-20", "12:00"),
        end: stamp("2026-10-20", "12:10"),
      },
    ],
  };
  const finished = finishShift(
    { ...afterFirst, timer: second },
    second,
    stamp("2026-10-20", "14:00"),
  );
  assert.equal(totals(calculate(finished.entries)).minutes, 450);
  assert.equal(
    finished.entries[0].automaticBreaks![0].end -
      finished.entries[0].automaticBreaks![0].start,
    20 * 60000,
  );
  assert.deepEqual(finished.entries[1].breaks, second.breaks);
  assert.equal(
    afterFirst.entries[0].automaticBreaks![0].end -
      afterFirst.entries[0].automaticBreaks![0].start,
    30 * 60000,
  );
  assert.doesNotThrow(() =>
    validateBackup(JSON.parse(JSON.stringify(finished))),
  );
  const longManual = {
    ...second,
    breaks: [
      {
        start: stamp("2026-10-20", "12:00"),
        end: stamp("2026-10-20", "12:40"),
      },
    ],
  };
  const longer = finishShift(
    { ...afterFirst, timer: longManual },
    longManual,
    stamp("2026-10-20", "14:00"),
  );
  assert.equal(totals(calculate(longer.entries)).minutes, 440);
  assert.equal(longer.entries[0].automaticBreaks, undefined);
  assert.deepEqual(longer.entries[1].breaks, longManual.breaks);
  assert.throws(() =>
    validateBackup({
      ...finished,
      entries: [
        { ...finished.entries[0], automaticBreaks: [{ start: 1, end: 2 }] },
        finished.entries[1],
      ],
    }),
  );
});
test("automatic stop reconciles a later manual break across split sessions", () => {
  const shift = { ...defaultShifts()[0], autoStop: true },
    j = { ...job, ...weeklyPolicy };
  const state = freshState();
  state.jobs = [j];
  const first = makeTimer(j, shift, stamp("2026-10-20", "06:00"), 30);
  const afterFirst = finishShift(
    { ...state, timer: first },
    first,
    stamp("2026-10-20", "10:00"),
  );
  const second = {
    ...makeTimer(j, shift, stamp("2026-10-20", "10:00"), 30),
    breaks: [
      {
        start: stamp("2026-10-20", "12:00"),
        end: stamp("2026-10-20", "12:10"),
      },
    ],
  };
  const stopped = settleTimer(
    { ...afterFirst, timer: second },
    stamp("2026-10-20", "14:15"),
  );
  assert.equal(stopped.timer, null);
  assert.equal(stopped.entries[1].end, stamp("2026-10-20", "14:00"));
  assert.equal(totals(calculate(stopped.entries)).minutes, 450);
});
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
test("week-boundary setting controls overtime independently of the displayed shift day", () => {
  const prior = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map(
    (d) => weeklyEntry(d, "06:00", "15:00"),
  );
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
  const monday = weeklyEntry("2026-10-26", "09:00", "17:00");
  const source = [...prior, night, monday];
  const split = calculate(source, "midnight").filter(
    (s) => s.entry.id === night.id,
  );
  const startWeek = calculate(source, "shift").filter(
    (s) => s.entry.id === night.id,
  );
  assert.equal(totals(split).extra, 90);
  assert.equal(totals(startWeek).extra, 420);
  assert.equal(totals(split).minutes, totals(startWeek).minutes);
  assert.deepEqual(
    split.map((s) => weekKey(localDate(s.weekDate))),
    ["2026-10-19", "2026-10-26"],
  );
  assert.deepEqual(
    startWeek.map((s) => weekKey(localDate(s.weekDate))),
    ["2026-10-19", "2026-10-19"],
  );
  const display = groupSlices(split, "shift");
  assert.deepEqual(
    display.map((s) => s.date),
    ["2026-10-25", "2026-10-25"],
  );
  assert.deepEqual(
    display.map((s) => s.weekDate),
    ["2026-10-25", "2026-10-26"],
  );
  assert.equal(
    totals(calculate(source, "shift").filter((s) => s.entry.id === monday.id))
      .extra,
    0,
  );
  const timer = makeTimer(
    { ...job, ...weeklyPolicy },
    defaultShifts()[1],
    night.start,
  );
  const active = previewSlices(
    prior,
    timer,
    stamp("2026-10-26", "06:00"),
    "shift",
  );
  assert.equal(
    totals(active.filter((s) => s.entry.id.startsWith("__active"))).extra,
    480,
  );
  const state = {
    ...freshState(),
    weekBoundary: "shift" as const,
    jobs: [{ ...job, ...weeklyPolicy }],
    entries: source,
  };
  assert.equal(
    validateBackup(JSON.parse(JSON.stringify(state))).weekBoundary,
    "shift",
  );
  assert.throws(() => validateBackup({ ...state, weekBoundary: "invalid" }));
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
  assert.equal(next.version, 8);
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
test("automatic language follows the device locale unless one is chosen", () => {
  assert.equal(languageFromLocale("pl"), "pl");
  assert.equal(languageFromLocale("PL"), "pl");
  assert.equal(languageFromLocale("en"), "en");
  assert.equal(languageFromLocale("de"), "en");
  assert.equal(languageFromLocale(null), "en");
  setDeviceLanguage("en");
  try {
    assert.equal(resolveLanguage(undefined), "en");
    assert.equal(resolveLanguage("pl"), "pl");
    assert.equal(translateText("Dzień"), "Day");
    assert.equal(translateText("Dzień", "pl"), "Dzień");
  } finally {
    setDeviceLanguage("pl");
  }
});
test("dashboard week table, errors and labels are translated to English", () => {
  for (const text of [
    "Dzień",
    "Start – koniec · razem",
    "Urlop",
    "Poprzedni tydzień",
    "Następny tydzień",
    "dni ·",
    "Koniec pracy nie może być w przyszłości.",
    "Edytuj wpis 2026-11-16",
    "Work Hours · 2.0.1 · dane na Twoim urządzeniu",
    "Usuniemy projekt, jego korekty salda oraz 3 jego wpisów. Inne miejsca pracy zostaną zachowane. Przywrócenie wymaga kopii JSON.",
  ])
    assert.notEqual(translateText(text, "en"), text, text);
});
test("all palettes preserve text contrast and map colours including transparent borders", () => {
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
  for (const tint of ["#EEEBFD", "#FFF4D6", "#FDE9F0"]) {
    assert.ok(contrast(themes.pastel.text, tint) >= 4.5, "pastel card text");
    assert.ok(
      contrast(themes.pastel.muted, tint) >= 4.5,
      "pastel card caption",
    );
  }
  assert.ok(contrast("#FFFFFF", "#1F7F37") >= 4.5, "start button");
  assert.ok(contrast("#00230A", "#30D158") >= 4.5, "dark start button");
  assert.ok(contrast("#FFFFFF", "#D7332B") >= 4.5, "stop button");
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
  assert.equal(validateBackup(previous).version, 8);
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
  assert.throws(() => validateBackup({ ...s, version: 9 }));
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
test("version 1 migration preserves entries and switches the running timer to weekly overtime", () => {
  const previous = {
    version: 1,
    jobs: [job],
    entries: [entry()],
    timer: null,
    currency: "GBP",
    paidWeeks: [],
  };
  const next = validateBackup(previous);
  assert.equal(next.version, 8);
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
  assert.deepEqual(validateBackup(running).timer, {
    ...running.timer,
    overtimeThreshold: "week",
    weeklyHours: 40,
    autoBreakMinutes: undefined,
    priorBreakMilliseconds: undefined,
  });
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
test("version 2 backups migrate unchanged to version 8 so old readers reject new policies", () => {
  const legacy = {
    ...freshState(),
    version: 2,
    jobs: [job],
    entries: [entry()],
  };
  const migrated = validateBackup(legacy);
  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.entries, legacy.entries);
  assert.deepEqual(migrated.shifts, legacy.shifts);
  assert.equal(totals(calculate(migrated.entries)).amount, 210);
});
