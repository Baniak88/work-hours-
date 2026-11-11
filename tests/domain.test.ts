import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
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
  type Entry,
  type Job,
} from "../src/domain";
const job: Job = {
  id: "job",
  name: "Bowmill",
  rate: 20,
  dailyHours: 8,
  overtime: 1.25,
  color: "#B4F272",
};
const stamp = (d: string, t: string) => parseLocal(d, t);
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
  assert.throws(() => validateBackup({ ...s, version: 2 }));
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
